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
const dataresult = async (shopid, fromdate, todate, branchcode, inquirytype, ispos) => {
  const pg = await provider.connectPG();
  let where = `WHERE shopid =  '${shopid}' AND iscancel = 'false'`;
  var res = { success: false, data: [], msg: "" };

  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += ` AND docdate BETWEEN '${fromdate} 00:00:00' AND '${todate} 23:59:59'`;
  } else if (utils.isNotEmpty(fromdate)) {
    where += ` AND docdate >= '${fromdate} 00:00:00'`;
  } else if (utils.isNotEmpty(todate)) {
    where += ` AND docdate <= '${todate} 23:59:59'`;
  } else {
    where += '';
  }


  if (utils.isNotEmpty(branchcode)) {
    where += ` AND branchcode = '${branchcode}'`;
  }

  if (utils.isNotEmpty(inquirytype)) {
    where += ` and inquirytype = '${inquirytype}' `;
  }

  console.log("ispos : " + ispos);

  if (utils.isNotEmpty(ispos)) {
    if (ispos == 1) {
      where += ` and ispos = true `;
    } else if (ispos == 0) {
      where += ` and ispos = false `;
    }
  }


  var query = `
    SELECT 
      date(docdate) AS doc_date
      ,sum(totalvalue) as total_value
      ,sum(detailtotaldiscount) as detail_total_discount
      ,sum(totalexceptvat) as total_except_vat
      ,round(sum(totalbeforevat),2) as total_before_vat
      ,round(sum(totalvatvalue),2) as total_vat_value
      ,sum(detailtotalamount) as detail_total_amount
      ,sum(totaldiscount) as total_discount
      ,sum(totalamount) as total_amount
    FROM 
    saleinvoice_transaction 
    ${where}
    GROUP BY 
      doc_date
    ORDER BY 
      doc_date
  `;

  console.log(query);


  try {
    await pg.connect();

    const result = await pg.query(query);
    res.success = true;
    res.data = result.rows;
    return res;
  } catch (error) {
    console.log(error);
    res.msg = error.message;
    return res;
  } finally {
    await pg.end();
  }
};

const genPDF = async (body, dataprofile, fromdate, todate, printby, branchcode, inquirytype, ispos) => {
  var custcodeText = "";
  var branchText = "";
  var inquirytypeText = "";
  var saleTypeText = "";

  if (utils.isNotEmpty(branchcode)) {
    branchText = ` , สาขา : ${branchcode}`;
  }


  if (utils.isNotEmpty(inquirytype)) {
    if (inquirytype == 0) {
      inquirytypeText = ` , ประเภทการขาย : เงินเชื่อ`;
    } else if (inquirytype == 1) {
      inquirytypeText = ` , ประเภทการขาย : เงินสด`;
    } else {
      inquirytypeText = ` , ประเภทการขาย ${inquirytype}`;
    }
  } else {
    inquirytypeText = ` , ประเภทการขาย : ทั้งหมด`;
  }

  if (utils.isNotEmpty(ispos)) {
    if (ispos == 1) {
      saleTypeText = ` , รายการ  : หน้าร้าน`;
    } else if (ispos == 0) {
      saleTypeText = ` , รายการ  : หลังร้าน`;
    }
  } else {
    saleTypeText = ` , รายการ  : ทั้งหมด`;
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
          text: "จากวันที่ : " + utils.formateDate(fromdate) + " ถึงวันที่ : " + utils.formateDate(todate) + custcodeText + branchText + inquirytypeText + saleTypeText,
          style: "subheader",
          alignment: "center",
          /// margin: [left, top, right, bottom]
          margin: [10, 0, 10, 10],

        },
        {
          alignment: "justify",
          columns: [
            {
              text: "หัวข้อ : รายงานการขายตามวัน",
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
      tableCell: {
        fontSize: 7,
      },
      tableFooter: {
        fontSize: 8,
        bold: true,
      },
    },
  };

  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 1,
        widths: ["11%", "11%", "12%", "11%", "11%", "11%", "11%", "11%", "11%"],
        body: body,

      },
      layout: {
        hLineWidth: function (i, node) {
          if (i === 0) return 1;
          if (i === 1) return 1;
          if (i === body.length - 1) return 1;
          if (i === body.length) return 1;
          return null;
        },
        vLineWidth: function (i, node) {
          return i === 0 || i === node.table.widths.length ? 0 : 0;
          return null;
        },

      },
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset, showsumbydate) => {
  let body = [];
  let mainSumTotal = resetSubtotals();

  // Define the header row for the table
  body.push([
    { text: "วันที่", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าสินค้า", style: "tableHeader", alignment: "left" },
    { text: "มูลค่าส่วนลดก่อนชำระเงิน", style: "tableHeader", alignment: "center" },
    { text: "มูลค่ายกเว้นภาษี", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าก่อนภาษี", style: "tableHeader", alignment: "center" },
    { text: "ภาษีมูลค่าเพิ่ม", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าหลังหักส่วนลด", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าส่วนลดท้ายบิล", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าสุทธิ", style: "tableHeader", alignment: "center" },

  ]);

  // Iterate through each dataset entry
  dataset.forEach((ele, index) => {


    // Process the current row
    processDataRow(ele, body,);

    // add main sum total
    mainSumTotal.totalValue += parseFloat(ele.total_value);
    mainSumTotal.detailTotalDiscount += parseFloat(ele.detail_total_discount);
    mainSumTotal.totalExceptVat += parseFloat(ele.total_except_vat);
    mainSumTotal.totalBeforeVat += parseFloat(ele.total_before_vat);
    mainSumTotal.totalVatValue += parseFloat(ele.total_vat_value);
    mainSumTotal.detailTotalAmount += parseFloat(ele.detail_total_amount);
    mainSumTotal.totalDiscount += parseFloat(ele.total_discount);
    mainSumTotal.totalAmount += parseFloat(ele.total_amount);

  });

  // Add overall totals row at the end
  addOverallTotalRow(body, mainSumTotal);

  return body;
};

function resetSubtotals() {
  return {
    totalValue: 0,
    detailTotalDiscount: 0,
    totalExceptVat: 0,
    totalBeforeVat: 0,
    totalVatValue: 0,
    detailTotalAmount: 0,
    totalDiscount: 0,
    totalAmount: 0,

  };
}

function processDataRow(ele, body) {
  // Add data row to body
  body.push([
    // Your data row cells here
    { text: `${utils.formateDate(ele.doc_date)}`, style: "tableCell", alignment: "left" },
    { text: utils.formatNumber(ele.total_value), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.detail_total_discount), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.total_except_vat), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.total_before_vat), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.total_vat_value), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.detail_total_amount), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.total_discount), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.total_amount), style: "tableCell", alignment: "right" },

  ]);


}


function addOverallTotalRow(body, totals) {
  body.push([
    { text: "รวม", style: "tableFooter", alignment: "left" },
    { text: utils.formatNumber(totals.totalValue), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.detailTotalDiscount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.totalExceptVat), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.totalBeforeVat), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.totalVatValue), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.detailTotalAmount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.totalDiscount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.totalAmount), style: "tableFooter", alignment: "right" },

  ]);
}

const pdfPreview = async (shopid, fromdate, todate, printby, branchcode, inquirytype, ispos, res) => {
  var dataset = await dataresult(shopid, fromdate, todate, branchcode, inquirytype, ispos);
  var dataprofile = await globalservice.dataShop(shopid);
  // console.log(dataset);
  // console.log(dataprofile);
  if (dataset.success && dataprofile.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, branchcode, inquirytype, ispos), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const genDownLoadSaleByDatePDF = async (fileName, shopid, fromdate, todate, printby, branchcode, inquirytype, ispos) => {
  console.log("processing");
  var dataset = await dataresult(shopid, fromdate, todate, branchcode, inquirytype, ispos);
  var dataprofile = await globalservice.dataShop(shopid);

  if (dataset.success) {
    try {
      var body = await genBodyPDF(dataset.data);
      var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, branchcode, inquirytype, ispos), {});
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



module.exports = { dataresult, genPDF, pdfPreview, genDownLoadSaleByDatePDF };
