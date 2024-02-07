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

const dataresult = async (token, fromuser, touser, fromdate, todate) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: [] };
  try {
    let db;
    db = client.db(process.env.MONGODB_DB);
    let filters = [];

    filters.push({
      shopid: token,
    });
    if (utils.isNotEmpty(fromuser) && utils.isNotEmpty(touser)) {
      filters.push({
        custcode: {
          $gte: fromuser,
        },
      });
      filters.push({
        custcode: {
          $lte: touser,
        },
      });
    }

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

    const transactionPaid = db.collection("transactionPaid");

    const result = await transactionPaid
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    resultSet.success = true;
    resultSet.data = result;
    const dataset = resultSet;
    //console.log(dataset);
    return dataset;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

const genPDF = async (body, dataprofile) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานการรับชำระหนี้",
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
        headerRows: 1,
        widths: ["15%", "20%", "15%", "10%", "10%", "15%", "15%"],
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
    { text: "เอกสารวันที่", style: "tableCell", alignment: "center" },
    { text: "เอกสารเลขที่", style: "tableCell", alignment: "center" },
    { text: "ลูกหนี้", style: "tableCell", alignment: "center" },
    { text: "จำนวนเงิน", style: "tableCell", alignment: "center" },
    { text: "เอกสารรับชำระวันที่", style: "tableCell", alignment: "center" },
    { text: "เอกสารรับชำระเลขที่", style: "tableCell", alignment: "center" },
    { text: "ยอดชำระ", style: "tableCell", alignment: "center" },
  ]);
  dataset.forEach((ele) => {
    console.log(ele);

    ele.details.forEach((detail) => {
      body.push([
        { text: utils.formateDate(detail.docdatetime), style: "tableCell", alignment: "center" },
        { text: detail.docno, style: "tableCell" },
        { text: ele.custcode + "|" + utils.packName(ele.custnames), style: "tableCell", alignment: "left" },
        { text: utils.formatNumber(detail.value), style: "tableCell", alignment: "right" },
        { text: utils.formateDate(ele.docdatetime), style: "tableCell", alignment: "center" },
        { text: ele.docno, style: "tableCell", alignment: "left" },
        { text: utils.formatNumber(detail.paymentamount), style: "tableCell", alignment: "right" },
      ]);
    });
  });
  return body;
};

const pdfPreview = async (token, fromuser, touser, fromdate, todate, res) => {
  var dataset = await dataresult(token, fromuser, touser, fromdate, todate);
  var dataprofile = await globalservice.dataShop(token);
  // console.log(dataset);
  // console.log(dataprofile);
  if (dataset.success && dataprofile.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const genDownLoadGetPaidPDF = async (token, search, fromdate, todate, fileName) => {
  console.log("processing");
  var dataset = await dataresult(token, search, fromdate, todate);
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
  var body = await genBodyPDF(dataset.data);
  var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="balance.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
};

module.exports = { dataresult, genPDF, pdfPreview, pdfDownload , genDownLoadGetPaidPDF};
