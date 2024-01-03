const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const globalservice = require("../../../globalservice");
const provider = require("../../../provider");
const dotenv = require("dotenv");
dotenv.config();

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

    const transactionPay = db.collection("transactionPay");

    const result = await transactionPay
      .aggregate([
        {
          $unionWith: {
            coll: "transactionSaleInvoiceReturn",
            pipeline: [
              {
                $match: {
                  inquirytype: {
                    $in: [2, 3],
                  },
                },
              },
            ],
          },
        },
        {
          $unionWith: {
            coll: "transactionPurchase",
            pipeline: [
              {
                $match: {
                  inquirytype: 1,
                },
              },
            ],
          },
        },
        {
          $match: {
            $and: filters,
          },
        },
        {
          $sort: {
            docdatetime: -1,
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
        text: "รายงานการจ่ายเงิน",
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
      tableFooter: {
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
        widths: ["15%", "15%", "15%", "9%", "9%", "9%", "9%", "9%", "9%"],
        body: body,
      },
      layout: "lightHorizontalLines",
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];
  var sumamount = 0;
  var sumcash = 0;
  var sumtransfer = 0;
  var sumcredit = 0;
  var sumcheque = 0;
  var sumcoupon = 0;
  body.push([
    { text: "เอกสารวันที่", style: "tableCell", alignment: "center" },
    { text: "เอกสารเลขที่", style: "tableCell", alignment: "center" },
    { text: "เจ้าหนี้", style: "tableCell", alignment: "center" },
    { text: "มูลค่าสุทธิ", style: "tableCell", alignment: "center" },
    { text: "เงินสด", style: "tableCell", alignment: "center" },
    { text: "เงินโอน", style: "tableCell", alignment: "center" },
    { text: "บัตรเครดิต", style: "tableCell", alignment: "center" },
    { text: "เช็ค", style: "tableCell", alignment: "center" },
    { text: "คูปอง", style: "tableCell", alignment: "center" },
  ]),
    dataset.forEach((ele) => {
      console.log(ele);

    
      var name = "";

      if(ele.custcode != ''){
        name = ele.custcode + "|" + utils.packName(ele.custnames);
      }
      body.push([
        { text: utils.formateDate(ele.docdatetime), style: "tableCell", alignment: "center" },
        { text: ele.docno, style: "tableCell" },
        { text: name, style: "tableCell", alignment: "left" },
        { text: utils.formatNumber(ele.totalamount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.paycashamount-ele.paycashchange), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.summoneytransfer), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.sumcreditcard), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.sumcheque), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.sumcoupon), style: "tableCell", alignment: "right" },
      ]);
      sumamount += ele.totalamount;
      sumcash += (ele.paycashamount-ele.paycashchange);
      sumtransfer += ele.summoneytransfer;
      sumcredit += ele.sumcreditcard;
      sumcheque += ele.sumcheque;
      sumcoupon += ele.sumcoupon;
    });
    body.push([
      { text: "",rowspan:3},
      { text: ""  },
      { text: "" },
      { text: utils.formatNumber(sumamount), style: "tableFooter", alignment: "right" },
      { text: utils.formatNumber(sumcash), style: "tableFooter", alignment: "right" },
      { text: utils.formatNumber(sumtransfer), style: "tableFooter", alignment: "right" },
      { text: utils.formatNumber(sumcredit), style: "tableFooter", alignment: "right" },
      { text: utils.formatNumber(sumcheque), style: "tableFooter", alignment: "right" },
      { text: utils.formatNumber(sumcoupon), style: "tableFooter", alignment: "right" },
    ]);
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

const pdfDownload = async (token, search, res) => {
  var dataset = await dataresult(token, search);
  var body = await genBodyPDF(dataset.data);
  var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="balance.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
};

module.exports = { dataresult, genPDF, pdfPreview, pdfDownload };
