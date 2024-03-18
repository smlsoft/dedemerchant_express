const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const provider = require("../../../provider");
const globalservice = require("../../../globalservice");
const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const { underline } = require("pdfkit");
const { Double } = require("mongodb");

const dataresultPage = async (token, search, fromdate, todate, page, pageSize) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: [], total: 0 };
  try {
    let db;
    db = client.db(process.env.MONGODB_DB);
    let filters = [];

    if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
      filters.push({
        docdatetime: {
          $gte: new Date(fromdate + "T00:00:00Z"),
        },
      });
      filters.push({
        docdatetime: {
          $lt: new Date(todate + "T23:59:59Z"),
        },
      });
    }

    if (utils.isNotEmpty(search)) {
      filters = [];
      const pattern = new RegExp(search, "i");
      filters.push({
        $or: [
          {
            docno: { $regex: pattern },
          },
          {
            custname: {
              $elemMatch: {
                name: { $regex: pattern },
              },
            },
          },
        ],
      });
    }

    filters.push({
      shopid: token,
    });

    const data = db.collection("transactionSaleInvoice");

    const totalCount = await data.countDocuments({ $and: filters });

    const offset = (page - 1) * pageSize;

    const result = await data.aggregate([{ $match: { $and: filters } }, { $sort: { docdatetime: 1 } }, { $skip: offset }, { $limit: pageSize }]).toArray();

    resultSet.success = true;
    resultSet.data = result;
    resultSet.total = totalCount;

    return resultSet;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

const dataresult = async (shopid, fromdate, todate, branchcode, printby, frombarcode, tobarcode, fromgroup, togroup) => {
  const pg = await provider.connectPG();
  var where = "";

  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += ` and date(docdate) between '${fromdate}' and '${todate}' `;
  } else if (utils.isNotEmpty(fromdate)) {
    where += ` and date(docdate) >= '${fromdate}' `;
  } else if (utils.isNotEmpty(todate)) {
    where += ` and date(docdate) <= '${todate}' `;
  }

  if (utils.isNotEmpty(branchcode)) {
    where += ` and branchcode = '${branchcode}' `;
  }

  if (utils.isNotEmpty(frombarcode) && utils.isNotEmpty(tobarcode)) {
    where += ` and barcode between '${frombarcode}' and '${tobarcode}' `;
  } else if (utils.isNotEmpty(frombarcode)) {
    where += ` and barcode = '${frombarcode}' `;
  } else if (utils.isNotEmpty(tobarcode)) {
    where += ` and barcode = '${tobarcode}' `;
  }

  if (utils.isNotEmpty(fromgroup) && utils.isNotEmpty(togroup)) {
    where += ` and groupcode between '${fromgroup}' and '${togroup}' `;
  } else if (utils.isNotEmpty(fromgroup)) {
    where += ` and groupcode = '${fromgroup}' `;
  } else if (utils.isNotEmpty(togroup)) {
    where += ` and groupcode = '${togroup}' `;
  }


  var query = `
  SELECT 
    barcode,itemnames
    ,date(docdate) as docdate,docno,unitnames
    ,qty,price,discountamount,sumamountexcludevat,totalvaluevat,sumamount,groupcode
    FROM saleinvoice_transaction_detail
    WHERE shopid = '${shopid}' ${where}
    ORDER BY barcode,docdate,docno
    `;


  try {
    await pg.connect();
    const result = await pg.query(query);

    const resultGroup = result.rows.reduce((acc, item) => {
      let entry = acc.find((e) => e.barcode === item.barcode);
      if (!entry) {
        entry = {
          barcode: item.barcode,
          itemnames: item.itemnames,
          totalqty: 0,
          totalamount: 0,
          totaldiscount: 0,
          totalvalue: 0,
          detailtotaldiscount: 0,
          totalexceptvat: 0,
          totalbeforevat: 0,
          totalvatvalue: 0,
          totalamount: 0,
          details: [],
        };
        acc.push(entry);
      }

      entry.details.push({
        docdate: item.docdate,
        docno: item.docno,
        unitnames: item.unitnames,
        qty: item.qty,
        price: item.price,
        discountamount: item.discountamount,
        sumamountexcludevat: item.sumamountexcludevat,
        totalvaluevat: item.totalvaluevat,
        sumamount: item.sumamount,
      });

      // console.log(entry.details);

      return acc;
    }, []);

    var res = { success: true, data: resultGroup, msg: "success" };
    // console.log(res);
    return res;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};



const genPDF = async (body, dataprofile, fromdate, todate, branchcode, printby , frombarcode , tobarcode , fromgroup , togroup) => {
  var branchText = "";
  var barcodeText = "";
  var groupText = "";


  if (utils.isNotEmpty(branchcode)) {
    branchText = ` , สาขา : ${branchcode}`;
  }

  if (utils.isNotEmpty(frombarcode) && utils.isNotEmpty(tobarcode)) {
    barcodeText = ` , บาร์โค้ด : ${frombarcode} ถึง ${tobarcode}`;
  } else if (utils.isNotEmpty(frombarcode)) {
    barcodeText = ` , บาร์โค้ด : ${frombarcode}`;
  } else if (utils.isNotEmpty(tobarcode)) {
    barcodeText = ` , บาร์โค้ด : ${tobarcode}`;
  }

  if (utils.isNotEmpty(fromgroup) && utils.isNotEmpty(togroup)) {
    groupText = ` , กลุ่มสินค้า : ${fromgroup} ถึง ${togroup}`;
  } else if (utils.isNotEmpty(fromgroup)) {
    groupText = ` , กลุ่มสินค้า : ${fromgroup}`;
  } else if (utils.isNotEmpty(togroup)) {
    groupText = ` , กลุ่มสินค้า : ${togroup}`;
  }

  var docDefinition = {
    header: function (currentPage, pageCount, pageSize) {
      return [
        {
          text: dataprofile.data.name1,
          style: "header",
          alignment: "center",
          /// margin: [left, top, right, bottom]
          margin: [10, 10, 10, 0],

        },
        {
          text: "จากวันที่ : " + utils.formateDate(fromdate) + " ถึงวันที่ : " + utils.formateDate(todate) + branchText + barcodeText + groupText,
          style: "subheader",
          alignment: "center",
          /// margin: [left, top, right, bottom]
          margin: [10, 0, 10, 10],

        },
        {
          alignment: "justify",
          columns: [
            {
              text: "หัวข้อ : รายงานการขาย ตามสินค้า",
              style: "subheader",
              alignment: "left",
              margin: [10, 0, 0, 0],
            },
            {
              text: "หน้า : " + currentPage + "/" + pageCount,
              style: "subheader",
              alignment: "right",
              margin: [0, 0, 10, 0],
            },
          ],
        },
        {
          alignment: "justify",
          columns: [
            {
              text: "พิมพ์โดย : " + printby,
              style: "subheader",
              alignment: "left",
              margin: [10, 0, 0, 0],
            },
            {
              text: "วันที่พิมพ์ : " + utils.formateDateTimeNow(new Date()),
              style: "subheader",
              alignment: "right",
              margin: [0, 0, 10, 0],
            },
          ],
        },
      ];
    },
    content: [],
    pageOrientation: "landscape",
    pageMargins: [10, 80, 10, 10], // [left, top, right, bottom]
    defaultStyle: {
      font: "Sarabun",
      fontSize: 12,
      columnGap: 20,
      color: "#000",
    },
    styles: {
      header: {
        fontSize: 13,
        bold: true,
        margin: [0, 0, 0, 5],
      },
      subheader: {
        fontSize: 9,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      tableHeader: {
        fontSize: 8,
        bold: true,
      },
      tableCellHeader: {
        fontSize: 7,
        bold: true,
      },
      tableCell: {
        fontSize: 7,
      },
      tableFooter: {
        fontSize: 7,
        bold: true,
      },
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 2,
        widths: ["8%", "16%", "13%", "9%", "9%", "9%", "9%", "9%", "9%", "9%"],
        body: body,
      },
      layout: {
        defaultBorder: false,
        // hLineWidth: function (i, node) {
        //   if (i === 0) return 2;
        //   if (i === 1) return 0;
        //   if (i === 2) return 2;
        //   if (i === body.length - 1) return 2;
        //   if (i === body.length) return 2;

        //   if (i > 0 && node.table.body[i - 1][1] && node.table.body[i - 1][1].text) {
        //     if (node.table.body[i - 1][1].text.includes("รวม ")) return 1;
        //   }


        //   return null;
        // },
        // vLineWidth: function (i, node) {
        //   return i === 0 || i === node.table.widths.length ? 0 : 0;
        //   return null;
        // },

      },
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];
  let borderTop = [false, true, false, false];
  let borderButtom = [false, false, false, true];

  let currentBarcode = "";
  let currentSubtotals = resetSubtotals();
  let mainSumTotal = resetSubtotals();

  // Define the header row for the table
  body.push(
    [
      { text: "บาร์โค้ด", style: "tableHeader", alignment: "center", border: borderTop },
      { text: "ชื่อสินค้า", style: "tableHeader", alignment: "center", border: borderTop },
      { text: "", style: "tableHeader", alignment: "left", border: borderTop },
      { text: "", style: "tableHeader", alignment: "left", border: borderTop },
      { text: "", style: "tableHeader", alignment: "left", border: borderTop },
      { text: "", style: "tableHeader", alignment: "left", border: borderTop },
      { text: "", style: "tableHeader", alignment: "left", border: borderTop },
      { text: "", style: "tableHeader", alignment: "left", border: borderTop },
      { text: "", style: "tableHeader", alignment: "left", border: borderTop },
      { text: "", style: "tableHeader", alignment: "left", border: borderTop },
    ],
    [
      { text: "", style: "tableHeader", alignment: "center", border: borderButtom },
      { text: "เอกสารวันที่", style: "tableHeader", alignment: "center", border: borderButtom },
      { text: "เอกสารเลขที่", style: "tableHeader", alignment: "center", border: borderButtom },
      { text: "หน่วยนับ", style: "tableHeader", alignment: "center", border: borderButtom },
      { text: "จำนวน", style: "tableHeader", alignment: "center", border: borderButtom },
      { text: "ราคา", style: "tableHeader", alignment: "center", border: borderButtom },
      { text: "มูลค่าส่วนลด", style: "tableHeader", alignment: "center", border: borderButtom },
      { text: "มูลค่าก่อนภาษี", style: "tableHeader", alignment: "center", border: borderButtom },
      { text: "ภาษีมูลค่าเพิ่ม", style: "tableHeader", alignment: "center", border: borderButtom },
      { text: "รวมมูลค่า", style: "tableHeader", alignment: "center", border: borderButtom },

    ]
  );


  // Iterate through each dataset entry
  dataset.forEach((ele, index) => {
    if (currentBarcode && currentBarcode !== ele.barcode) {
      currentSubtotals = resetSubtotals(); // Reset subtotals for the new barcode
    }

    currentBarcode = ele.barcode;

    // Process the current row
    processDataRow(ele, body, currentSubtotals);

    ele.details.forEach((detail) => {
      // add main sum total
      mainSumTotal.totalqty += parseFloat(detail.qty);
      mainSumTotal.detailtotaldiscount += parseFloat(detail.discountamount);
      mainSumTotal.totalexceptvat += parseFloat(detail.sumamountexcludevat);
      mainSumTotal.totalvatvalue += parseFloat(detail.totalvaluevat);
      mainSumTotal.totalamount += parseFloat(detail.sumamount);
    });

  });

  // Add overall totals row at the end
  addOverallTotalRow(body, mainSumTotal);

  return body;
};
function resetSubtotals() {
  return {
    totalqty: 0,
    detailtotaldiscount: 0,
    totalexceptvat: 0,
    totalvatvalue: 0,
    totalamount: 0,
  };
}

function processDataRow(ele, body, subtotals) {

  // Add data row to body
  body.push([
    // Your data row cells here
    { text: ele.barcode, style: "tableCellHeader", alignment: "left" },
    { text: utils.packName(ele.itemnames), style: "tableCellHeader", alignment: "left" },
    { text: "", style: "tableCellHeader", alignment: "left" },
    { text: "", style: "tableCellHeader", alignment: "left" },
    { text: "", style: "tableCellHeader", alignment: "left" },
    { text: "", style: "tableCellHeader", alignment: "left" },
    { text: "", style: "tableCellHeader", alignment: "left" },
    { text: "", style: "tableCellHeader", alignment: "left" },
    { text: "", style: "tableCellHeader", alignment: "left" },
    { text: "", style: "tableCellHeader", alignment: "left" },

  ]);

  /// Add data row details to body
  ele.details.forEach((detail) => {
    body.push([
      // Your data row cells here
      { text: "", style: "tableCell", alignment: "center" },
      { text: utils.formateDate(detail.docdate), style: "tableCell", alignment: "left" },
      { text: detail.docno, style: "tableCell", alignment: "left" },
      { text: utils.packName(detail.unitnames), style: "tableCell", alignment: "left" },
      { text: utils.formatNumber(detail.qty), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(detail.price), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(detail.discountamount), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(detail.sumamountexcludevat), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(detail.totalvaluevat), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(detail.sumamount), style: "tableCell", alignment: "right" },
    ]);
    // Update subtotals 
    subtotals.totalqty += parseFloat(detail.qty);
    subtotals.detailtotaldiscount += parseFloat(detail.discountamount);
    subtotals.totalexceptvat += parseFloat(detail.sumamountexcludevat);
    subtotals.totalvatvalue += parseFloat(detail.totalvaluevat);
    subtotals.totalamount += parseFloat(detail.sumamount);

  });

  addSubtotalRow(body, ele.itemnames, subtotals);

}



function addSubtotalRow(body, itemnames, subtotals) {
  let borderButtom = [false, false, false, true];

  body.push([
    { text: "", style: "tableFooter", alignment: "left" },
    { text: `รวม ${utils.packName(itemnames)}`, style: "tableFooter", alignment: "left", border: borderButtom },
    { text: "", style: "tableFooter", alignment: "left", border: borderButtom },
    { text: "", style: "tableFooter", alignment: "left", border: borderButtom },
    { text: utils.formatNumber(subtotals.totalqty), style: "tableFooter", alignment: "right", border: borderButtom },
    { text: "", style: "tableFooter", alignment: "left", border: borderButtom },
    { text: utils.formatNumber(subtotals.detailtotaldiscount), style: "tableFooter", alignment: "right", border: borderButtom },
    { text: utils.formatNumber(subtotals.totalexceptvat), style: "tableFooter", alignment: "right", border: borderButtom },
    { text: utils.formatNumber(subtotals.totalvatvalue), style: "tableFooter", alignment: "right", border: borderButtom },
    { text: utils.formatNumber(subtotals.totalamount), style: "tableFooter", alignment: "right", border: borderButtom },

  ]);
}

function addOverallTotalRow(body, totals) {
  let borderButtom = [false, true, false, true];

  body.push([
    { text: "", style: "tableFooter", alignment: "left", border: borderButtom },
    { text: "รวม", style: "tableFooter", alignment: "left", border: borderButtom },
    { text: "", style: "tableFooter", alignment: "left", border: borderButtom },
    { text: "", style: "tableFooter", alignment: "left", border: borderButtom },
    { text: utils.formatNumber(totals.totalqty), style: "tableFooter", alignment: "right", border: borderButtom },
    { text: "", style: "tableFooter", alignment: "left", border: borderButtom },
    { text: utils.formatNumber(totals.detailtotaldiscount), style: "tableFooter", alignment: "right", border: borderButtom },
    { text: utils.formatNumber(totals.totalexceptvat), style: "tableFooter", alignment: "right", border: borderButtom },
    { text: utils.formatNumber(totals.totalvatvalue), style: "tableFooter", alignment: "right", border: borderButtom },
    { text: utils.formatNumber(totals.totalamount), style: "tableFooter", alignment: "right", border: borderButtom },

  ]);
}

const pdfPreview = async (shopid, fromdate, todate, branchcode, printby, frombarcode, tobarcode, fromgroup, togroup, res) => {
  var dataset = await dataresult(shopid, fromdate, todate, branchcode, printby, frombarcode, tobarcode, fromgroup, togroup);
  var dataprofile = await globalservice.dataShop(shopid);
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, branchcode, printby, frombarcode, tobarcode, fromgroup, togroup), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const genDownLoadSaleByProductPDF = async (fileName, shopid, fromdate, todate, branchcode, printby, frombarcode, tobarcode, fromgroup, togroup) => {
  console.log("processing");
  var dataset = await dataresult(shopid, fromdate, todate, branchcode, printby, frombarcode, tobarcode, fromgroup, togroup);
  var dataprofile = await globalservice.dataShop(shopid);

  if (dataset.success) {
    try {
      var body = await genBodyPDF(dataset.data);

      var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, branchcode, printby, frombarcode, tobarcode, fromgroup, togroup), {});
      const tempPath = path.join(os.tmpdir(), fileName);

      const writeStream = fs.createWriteStream(tempPath);

      pdfDoc.pipe(writeStream);

      pdfDoc.end();

      writeStream.on("error", function (err) {
        console.error("Error writing PDF to file:", err);
      });

      writeStream.on("finish", function () {
        console.log(`PDF written to ${tempPath}`);
      });
    } catch (err) {
      console.log(err);
    }
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};


const pdfDownload = async (token, search, res) => {
  var dataset = await dataresult(token, search);
  var body = await genBodyPDF(dataset.data);
  var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="balance.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
};

const sendEmail = async (token, emails) => {
  try {
    var dataset = await dataresult(token);
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
    pdfDoc.end();
    let transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      secure: false,
      port: process.env.MAIL_PORT,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
    emails.forEach((email, index) => {
      setTimeout(async () => {
        var name = "fish";
        console.log("sending email..." + email);
        let HelperOptions = {
          from: '"DEDEMerchant Sale Report <admin@smldatacenter.com>',
          to: email,
          subject: "Sale Report  from DEDEMerchant",
          html: "Hello " + name + ",<br><br> Here is your PDF ",
          attachments: [
            {
              filename: "Sale2021.pdf",
              content: pdfDoc,
              contentType: "application/pdf",
            },
          ],
        };
        await transporter.sendMail(HelperOptions, (error, info) => {
          console.log(info);
          if (error) {
            return console.log("error " + error);
          }

          console.log("The message was sent!");
        });

        console.log("sending email done");
      }, index * 1000);
    });
  } catch (err) {
    console.log(err.message);
  }
};

module.exports = { dataresult, genPDF, pdfPreview, pdfDownload, sendEmail, genDownLoadSaleByProductPDF, dataresultPage };
