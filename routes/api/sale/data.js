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

const dataresult = async (shopid, fromdate, todate, showdetail, branchcode, iscancel, inquirytype, ispos) => {
  const pg = await provider.connectPG();
  var where = "";

  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += `and date(st.docdate) between '${fromdate}' and '${todate}' `;
  } else if (utils.isNotEmpty(fromdate)) {
    where += `and date(st.docdate) >= '${fromdate}' `;
  } else if (utils.isNotEmpty(todate)) {
    where += `and date(st.docdate) <= '${todate}' `;
  }

  if (utils.isNotEmpty(branchcode)) {
    where += `and branchcode = '${branchcode}' `;
  }

  if (utils.isNotEmpty(iscancel)) {
    where += `and iscancel = '${iscancel}' `;
  }else{
    where += `and iscancel =  false`;
  }

  if (utils.isNotEmpty(inquirytype)) {
    where += `and inquirytype = '${inquirytype}' `;
  }

  if (utils.isNotEmpty(ispos)) {
    where += `and ispos = '${ispos}' `;
  }

  var query = `select date(st.docdate) as docdate,TO_CHAR(st.docdate+'07:00', 'HH24:MI') AS doc_time,st.docno
  ,creditornames[0]->>'name' AS cust_name
  ,totalvalue, coalesce(detailtotaldiscount,0) as detailtotaldiscount ,totalexceptvat
  ,round(totalbeforevat,2) as totalbeforevat
  ,round(totalvatvalue,2) as totalvatvalue
  ,coalesce(detailtotalamount,0) as detailtotalamount,coalesce(totaldiscount,0) as totaldiscount,coalesce(totalamount,0) as totalamount 
  ,salename
  from saleinvoice_transaction st
  where st.shopid = '${shopid}' ${where}
  order by docdate,docno `;

  if (showdetail == 1) {
    query = `select date(st.docdate) as docdate,TO_CHAR(st.docdate+'07:00', 'HH24:MI') AS doc_time,st.docno
    ,creditornames[0]->>'name' AS cust_name
    ,totalvalue,coalesce(detailtotaldiscount,0) as detailtotaldiscount,totalexceptvat
    ,round(totalbeforevat,2) as totalbeforevat
    ,round(totalvatvalue,2) as totalvatvalue
    ,coalesce(detailtotalamount,0) as detailtotalamount,coalesce(totaldiscount,0) as totaldiscount, coalesce(totalamount,0) as totalamount 
    ,salename,
    barcode,itemnames[0]->>'name' as item_name
    ,unitnames[0]->>'name' AS unit_name
    ,whnames[0]->>'name' AS whname,locationnames[0]->>'name' AS lcname
    ,qty,price,discountamount,sumamount
    from saleinvoice_transaction st left join saleinvoice_transaction_detail std on std.shopid = st.shopid and std.docno = st.docno 
    where st.shopid = '${shopid}' ${where}
    order by st.docdate,docno`;
  }

  try {
    await pg.connect();
    const result = await pg.query(query);

    const resultGroup = result.rows.reduce((acc, item) => {
      let entry = acc.find((e) => e.docno === item.docno);
      if (!entry) {
        entry = {
          docdate: item.docdate,
          doc_time: item.doc_time,
          docno: item.docno,
          cust_name: item.cust_name,
          totalvalue: item.totalvalue,
          detailtotaldiscount: item.detailtotaldiscount,
          totalexceptvat: item.totalexceptvat,
          totalbeforevat: item.totalbeforevat,
          totalvatvalue: item.totalvatvalue,
          detailtotalamount: item.detailtotalamount,
          totaldiscount: item.totaldiscount,
          totalamount: item.totalamount,
          salename: item.salename,
          details: [],
        };
        acc.push(entry);
      }

      entry.details.push({
        barcode: item.barcode,
        item_name: item.item_name,
        unit_name: item.unit_name,
        whname: item.whname,
        lcname: item.lcname,
        qty: item.qty,
        price: item.price,
        discountamount: item.discountamount,
        sumamount: item.sumamount,
      });

      return acc;
    }, []);
  
    var res = { success: true, data: resultGroup, msg: "success" };
    //console.log(res);
    return res;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

const groupedData = async (data) => {
  return data.reduce((acc, item) => {
    const key = `${item.docno}`;

    if (!acc[key]) {
      acc[key] = {
        docdate: item.docdate,
        doc_time: item.doc_time,
        docno: item.docno,
        cust_name: item.cust_name,
        totalvalue: item.totalvalue,
        detailtotaldiscount: item.detailtotaldiscount,
        totalexceptvat: item.totalexceptvat,
        totalbeforevat: item.totalbeforevat,
        totalvatvalue: item.totalvatvalue,
        detailtotalamount: item.detailtotalamount,
        totaldiscount: item.totaldiscount,
        totalamount: item.totalamount,
        salename: item.salename,
        details: [],
      };
    }
    if (item.barcode !== undefined && item.barcode !== null && item.barcode !== "") {
      acc[key].details.push({
        barcode: item.barcode,
        item_name: item.item_name,
        unit_name: item.unit_name,
        whname: item.whname,
        lcname: item.lcname,
        qty: item.qty,
        price: item.price,
        discountamount: item.discountamount,
        sumamount: item.sumamount,
      });
    }

    return acc;
  }, {});
};

// const dataresult = async (token, search, fromdate, todate) => {
//   const client = await provider.connectToMongoDB();
//   var resultSet = { success: false, data: [] };
//   try {
//     let db;
//     db = client.db(process.env.MONGODB_DB);
//     let filters = [];

//     if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
//       filters.push({
//         docdatetime: {
//           $gte: new Date(fromdate + "T00:00:00Z"),
//         },
//       });
//       filters.push({
//         docdatetime: {
//           $lt: new Date(todate + "T23:59:59Z"),
//         },
//       });
//     }

//     if (utils.isNotEmpty(search)) {
//       filters = [];
//       const pattern = new RegExp(search, "i");
//       filters.push({
//         $or: [
//           {
//             docno: { $regex: pattern },
//           },
//           {
//             custname: {
//               $elemMatch: {
//                 name: { $regex: pattern },
//               },
//             },
//           },
//         ],
//       });
//     }

//     filters.push({
//       shopid: token,
//     });

//     const data = db.collection("transactionSaleInvoice");

//     const result = await data
//       .aggregate([
//         {
//           $match: {
//             $and: filters,
//           },
//         },
//         {
//           $sort: { docdatetime: 1 }, // Sorting in descending order
//         },
//       ])
//       .toArray();
//     resultSet.success = true;
//     resultSet.data = result;
//     const dataset = resultSet;

//     for (let index = 0; index < dataset.data.length; index++) {
//       //   console.log(index + " : " + dataset.data[index].docdatetime);
//     }

//     return dataset;
//   } catch (error) {
//     console.error("Error connecting to MongoDB:", error);
//   } finally {
//     await client.close();
//   }
// };

const genPDF = async (body, dataprofile, showdetail) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานขาย",
        style: "header",
        alignment: "center",
      },
      {
        text: dataprofile.data.name1,
        style: "subheader",
        alignment: "center",
      },
    ],
    pageOrientation: "landscape",
    pageMargins: [10, 10, 10, 10], // [left, top, right, bottom]
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
        fontSize: 13,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      tableCell: {
        fontSize: 9,
      },
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: showdetail == 1 ? 2 : 1,
        widths: ["15%", "20%", "10%", "10%", "9%", "9%", "9%", "9%", "9%", "10%"],
        body: body,
      },
      layout: "lightHorizontalLines",
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];

  body.push(
    [
      { text: "เอกสารวันที่", style: "tableCell", alignment: "left" },
      { text: "เอกสารเลขที่", style: "tableCell", alignment: "left" },
      { text: "ลูกหนี้", style: "tableCell", alignment: "left" },
      { text: "มูลค่าสินค้า", style: "tableCell", alignment: "left" },
      { text: "มูลค่าส่วนลด", style: "tableCell", alignment: "left" },
      { text: "หลังหักส่วนลด", style: "tableCell", alignment: "left" },
      { text: "ยกเว้นภาษี", style: "tableCell", alignment: "left" },
      { text: "ภาษีมูลค่าเพิ่ม", style: "tableCell", alignment: "left" },
      { text: "มูลค่าสุทธิ", style: "tableCell", alignment: "left" },
    ],
    [
      { text: "บาร์โค้ด", style: "tableCell", alignment: "center" },
      { text: "ชื่อสินค้า", style: "tableCell", alignment: "center" },
      { text: "คลัง", style: "tableCell", alignment: "center" },
      { text: "พื้นที่เก็บ", style: "tableCell", alignment: "center" },
      { text: "หน่วยนับ", style: "tableCell", alignment: "center" },
      { text: "จำนวน", style: "tableCell", alignment: "center" },
      { text: "ราคา", style: "tableCell", alignment: "center" },
      { text: "ส่วนลด", style: "tableCell", alignment: "center" },
      { text: "รวมมูลค่า", style: "tableCell", alignment: "center" },
    ]
  );

  const result = [];

  //console.log(dataset)
  await dataset.forEach((entry) => {
   // console.log(entry);
    const dateKey = utils.extractDate(entry.docdate);
    let found = result.find((item) => item.docdate === dateKey);

    if (!found) {
      found = {
        docdate: dateKey,
        detailtotalamount: 0,
        totaldiscount: 0,
        totalexceptvat: 0,
        totalbeforevat: 0,
        totalvatvalue: 0,
        totalamount: 0,
        details: [],
      };
      result.push(found);
    }
    // console.log("found", found);
    found.detailtotalamount += entry.detailtotalamount || 0;
    found.totaldiscount += entry.totaldiscount || 0;
    found.totalexceptvat += entry.totalexceptvat || 0;
    found.totalbeforevat += entry.totalbeforevat || 0;
    found.totalvatvalue += entry.totalvatvalue || 0;
    found.totalamount += entry.totalamount || 0;

    found.details.push({
      docdate: entry.docdate,
      docno: entry.docno,
      custcode: entry.custcode,
      custnames: entry.custnames,
      detailtotalamount: entry.detailtotalamount,
      totaldiscount: entry.totaldiscount,
      totalexceptvat: entry.totalexceptvat,
      totalbeforevat: entry.totalbeforevat,
      totalvatvalue: entry.totalvatvalue,
      totalamount: entry.totalamount,
      details: entry.details,
    });
  });

  result.forEach((data) => {
    data.details.forEach((ele) => {
      body.push([
        { text: utils.formateDate(ele.docdate), style: "tableCell", alignment: "left", fillColor: "#f5e8c4" },
        { text: ele.docno, style: "tableCell", fillColor: "#f5e8c4" },
        { text: utils.packName(ele.custnames), style: "tableCell", alignment: "left", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.detailtotalamount), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totaldiscount), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totalbeforevat), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totalexceptvat), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totalvatvalue), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totalamount), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
      ]);

      ele.details.forEach((detail) => {
        body.push([
          { text: detail.barcode, style: "tableCell" },
          { text: detail.item_name, style: "tableCell" },
          { text: detail.whname, style: "tableCell", alignment: "center" },
          { text: detail.lcname, style: "tableCell", alignment: "center" },
          { text: detail.unit_name, style: "tableCell", alignment: "center" },
          { text: utils.formatNumber(detail.qty), style: "tableCell", alignment: "right" },
          { text: utils.formatNumber(detail.price), style: "tableCell", alignment: "right" },
          { text: utils.formatNumber(detail.discountamount), style: "tableCell", alignment: "right" },
          { text: utils.formatNumber(detail.sumamount), style: "tableCell", alignment: "right" },
        ]);
      });
    });

    body.push([
      { text: "", style: "tableCell", alignment: "center" },
      { text: "", style: "tableCell" },
      { text: "รวม", style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(data.detailtotalamount), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(data.totaldiscount), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(data.totalbeforevat), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(data.totalexceptvat), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(data.totalvatvalue), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(data.totalamount), style: "tableCell", alignment: "right" },
    ]);
  });

  var totalDetailtotalamount = 0;
  var totalTotaldiscount = 0;
  var totalTotalexceptvat = 0;
  var totalTotalbeforevat = 0;
  var totalTotalvatvalue = 0;
  var totalTotalamount = 0;

  dataset.forEach((ele) => {
    totalDetailtotalamount += ele.detailtotalamount;
    totalTotaldiscount += ele.totaldiscount;
    totalTotalexceptvat += ele.totalexceptvat;
    totalTotalbeforevat += ele.totalbeforevat;
    totalTotalvatvalue += ele.totalvatvalue;
    totalTotalamount += ele.totalamount;
  });
  body.push([
    { text: "", style: "tableCell", alignment: "center", fillColor: "#f5e8c4" },
    { text: "", style: "tableCell", fillColor: "#f5e8c4" },
    { text: "รวม", style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
    { text: utils.formatNumber(totalDetailtotalamount), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
    { text: utils.formatNumber(totalTotaldiscount), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
    { text: utils.formatNumber(totalTotalbeforevat), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
    { text: utils.formatNumber(totalTotalexceptvat), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
    { text: utils.formatNumber(totalTotalvatvalue), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
    { text: utils.formatNumber(totalTotalamount), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
  ]);

  return body;
};

const pdfPreview = async (shopid, fromdate, todate, showdetail, branchcode, iscancel, inquirytype, ispos, res) => {
  var dataset = await dataresult(shopid, fromdate, todate, showdetail, branchcode, iscancel, inquirytype, ispos);
  var dataprofile = await globalservice.dataShop(shopid);
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const genDownLoadSaleInvPDF = async (shopid, fromdate, todate, fileName, showdetail, branchcode, iscancel, inquirytype, ispos) => {
  console.log("processing");
  var dataset = await dataresult(shopid, fromdate, todate, showdetail, branchcode, iscancel, inquirytype, ispos);
  var dataprofile = await globalservice.dataShop(shopid);

  if (dataset.success) {
    try {
      var body = await genBodyPDF(dataset.data);

      var pdfDoc = await printer.createPdfKitDocument(await genPDF(body, dataprofile, showdetail), {});
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

function formatDateString(dateStr) {
  const parsedDate = new Date(dateStr);
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const year = parsedDate.getFullYear();
  return `${day}/${month}/${year}`;
}

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

module.exports = { dataresult, genPDF, pdfPreview, pdfDownload, sendEmail, genDownLoadSaleInvPDF, dataresultPage };
