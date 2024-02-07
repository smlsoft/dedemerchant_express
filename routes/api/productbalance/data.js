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

const dataresult = async (shopid, search) => {
  const pg = await provider.connectPG();
  var where = "";
  var res = { success: false, data: [], msg: "" };
  if (utils.isNotEmpty(search)) {
    where += ` and ( barcode like '%${search}%'  or EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(a.names) AS element
      WHERE element LIKE '%${search}%'
  ) )`;
  }

  var query = `select a.shopid,a.barcode
  ,a.names,
  a.unitcode as unitcode
  ,(select b.unitcode from productbarcode b where b.barcode = a.mainbarcoderef limit 1) as standunit
  ,a.balanceqty,a.averagecost,a.balanceamount
  from productbarcode a
  where a.shopid = '${shopid}' ${where} 
  order by a.barcode  `;
  try {
    await pg.connect();
    console.log(query);

    const result = await pg.query(query);
    res.success = true;
    res.data = result.rows;
    return res;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};
const genPDF = async (body, dataprofile) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานสินค้าคงเหลือ",
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
      tableHeader: {
        fontSize: 9,
        bold: true,
      },
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 1,
        widths: ["5%", "15%", "20%", "15%", "15%", "15%", "15%"],
        body: body,
      },
      layout: "lightHorizontalLines",
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];

  body.push([
    { text: "ลำดับ", style: "tableHeader", alignment: "center" },
    { text: "บาร์โค้ด", style: "tableHeader", alignment: "center" },
    { text: "ชื่อสินค้า", style: "tableHeader", alignment: "center" },
    { text: "หน่วยคงเหลือ", style: "tableHeader", alignment: "center" },
    { text: "ยอดคงเหลือ", style: "tableHeader", alignment: "center" },
    { text: "ต้นทุนเฉลี่ย", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าคงเหลือ", style: "tableHeader", alignment: "center" },
  ]);
  var idx = 1;
  var sumBalance = 0;
  var sumCost = 0;
  var sumAmount = 0;
  dataset.forEach((ele) => {
    body.push([
      { text: idx, style: "tableCell", alignment: "center" },
      { text: ele.barcode, style: "tableCell" },
      { text: utils.packName(ele.names) + " / " + ele.unitcode, style: "tableCell", alignment: "left" },
      { text: ele.standunit, style: "tableCell", alignment: "center" },
      { text: utils.formatNumber(ele.balanceqty), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.averagecost), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.balanceamount), style: "tableCell", alignment: "right" },
    ]);
    sumBalance = sumBalance + parseFloat(ele.balanceqty);
    sumCost = sumCost + parseFloat(ele.averagecost);
    sumAmount = sumAmount + parseFloat(ele.balanceamount);
    idx = idx + 1;
  });

  body.push([
    { text: "รวม", style: "tableHeader", alignment: "center", colSpan: 4 },
    {},
    {},
    {},
    { text: utils.formatNumber(sumBalance), style: "tableHeader", alignment: "right" },
    { text: utils.formatNumber(sumCost), style: "tableHeader", alignment: "right" },
    { text: utils.formatNumber(sumAmount), style: "tableHeader", alignment: "right" },
  ]);
  return body;
};

const pdfPreview = async (token, search, res) => {
  var dataset = await dataresult(token, search);
  console.log(dataset);
  var dataprofile = await globalservice.dataShop(token);
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "" });
  }
};

const genDownLoadProductBalancePDF = async (token, search, fileName) => {
  console.log("processing");
  var dataset = await dataresult(token, search);
  var dataprofile = await globalservice.dataShop(token);

  if (dataset.success) {
    try {
      var body = await genBodyPDF(dataset.data);

      var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
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
  console.log(dataset);
  var dataprofile = await globalservice.dataShop(token);
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="productbalance.pdf"');
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "" });
  }
};

module.exports = { dataresult, pdfPreview, pdfDownload , genDownLoadProductBalancePDF};
