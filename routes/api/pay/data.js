const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const globalservice = require("../../../globalservice");
const provider = require("../../../provider");
const dotenv = require("dotenv");
dotenv.config();

const dataShop = async (token) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: null };
  try {
    let db;
    db = client.db(process.env.MONGO_DB_NAME);
    const shops = db.collection("shops");
    const data = await shops.find({ guidfixed: token }).toArray();

    if (data.length > 0) {
      resultSet.success = true;
      resultSet.data = data[0];
    } else {
      resultSet.success = false;
      resultSet.data = null;
    }

    // console.log(data);
    return resultSet;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

const dataresult = async (token, fromuser, touser, fromdate, todate) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: [] };
  try {
    let db;
    db = client.db(process.env.MONGO_DB_NAME);
    let filters = [];

    filters.push({
      shopid: {
        $lte: token,
      },
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
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 1,
        widths: ["15%", "20%", "15%", "15%", "15%", "10%", "10%", "10%"],
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
    { text: "เจ้าหนี้", style: "tableCell", alignment: "center" },
    { text: "มูลค่าสุทธิ", style: "tableCell", alignment: "center" },
    { text: "เงินสด", style: "tableCell", alignment: "center" },
    { text: "เงินโอน", style: "tableCell", alignment: "center" },
    { text: "บัตรเครดิต", style: "tableCell", alignment: "center" },
  ]),
    dataset.forEach((ele) => {
      console.log(ele);

      var creditAmount = 0;
      var transferAmount = 0;

      var cash = 0;
      if (ele.paymentdetail != undefined && ele.paymentdetail != "undefined" && ele.paymentdetail != null) {
        cash = ele.paymentdetail.cashamount;

        if (ele.paymentdetail.paymentcreditcards != null) {
          ele.paymentdetail.paymentcreditcards.forEach((ele) => {
            creditAmount += ele.amount;
          });
        }
        if (ele.paymentdetail.paymenttransfers != null) {
          ele.paymentdetail.paymenttransfers.forEach((ele) => {
            transferAmount += ele.amount;
          });
        }
      }
      body.push([
        { text: utils.formateDate(ele.docdatetime), style: "tableCell", alignment: "center" },
        { text: ele.docno, style: "tableCell" },
        { text: ele.custcode + "|" + utils.packName(ele.custnames), style: "tableCell", alignment: "left" },
        { text: utils.formatNumber(ele.totalamount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(cash), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(transferAmount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(creditAmount), style: "tableCell", alignment: "right" },
      ]);
    });
  return body;
};

const pdfPreview = async (token, fromuser, touser, fromdate, todate, res) => {
  var dataset = await dataresult(token, fromuser, touser, fromdate, todate);
  var dataprofile = await dataShop(token);
  // console.log(dataset);
  // console.log(dataprofile);
  if (dataset.success && dataprofile.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
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

module.exports = { dataresult, genPDF, pdfPreview, pdfDownload, sendEmail };
