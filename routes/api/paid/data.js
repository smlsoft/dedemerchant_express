const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const globalservice = require("../../../globalservice");
const dotenv = require("dotenv");
dotenv.config();

const dataShop = async (token) => {
  var resultSet = { success: false, data: [] };
  await globalservice
    .getProfileshop(token)
    .then((res) => {
      //console.log(res);
      if (res.success) {
        // console.log(res.data);
        resultSet.success = true;
        resultSet.data = res.data;
      }
    })
    .catch((err) => {
      console.log(err);
    });

  const dataprofile = await resultSet;
  // console.log(dataprofile);
  return dataprofile;
};

const dataresult = async (token, search,fromdate,todate) => {
  var resultSet = { success: false, data: null };
  await globalservice
    .getReport('/transaction/paid',token, search,fromdate,todate)
    .then((res) => {
      console.log(res);
      if (res.success) {
        console.log(res.data);
        resultSet.success = true;
        resultSet.data = res.data;
      }
    })
    .catch((err) => {
      console.log(err);
    });

  const dataset = await resultSet;
  console.log(dataset);
  return dataset;
};

const genPDF = async (body,dataprofile) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานการรับเงิน",
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
        margin: [0, 0, 0, 5]
      },
      subheader: {
        fontSize: 13,
        bold: true,
        margin: [0, 0, 0, 10]
      },
      tableCell: {
        fontSize: 9
    }
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 1,
        widths: ['15%', '20%', '15%', '15%' ,'15%' , '10%' , '10%' , '10%' ],
        body: body
      },
      layout: "lightHorizontalLines",
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];

  body.push([
    { text: "เอกสารวันที่", style: 'tableCell',alignment: "center" },
    { text: "เอกสารเลขที่", style: 'tableCell',alignment: "center" },
    { text: "ลูกหนี้", style: 'tableCell',alignment: "center" },
    { text: "มูลค่าสุทธิ", style: 'tableCell',alignment: "center" },
    { text: "เงินสด", style: 'tableCell',alignment: "center" },
    { text: "เงินโอน", style: 'tableCell',alignment: "center" },
    { text: "บัตรเครดิต", style: 'tableCell',alignment: "center" },
  ]),
  dataset.forEach((ele) => {
    console.log(ele)
    var creditAmount = 0;
    var transferAmount = 0;
    if(ele.paymentdetail.paymentcreditcards != null){
      ele.paymentdetail.paymentcreditcards.forEach(ele => {
        creditAmount += ele.amount ;
      });
    }
    if(ele.paymentdetail.paymenttransfers != null){
      ele.paymentdetail.paymenttransfers.forEach(ele => {
        transferAmount += ele.amount ;
      });
    }
    body.push([
      { text: utils.formateDate(ele.docdatetime) ,style: 'tableCell',alignment: "center"  },
      { text: ele.docno ,style: 'tableCell' },
      { text: ele.custcode+"|"+utils.packName(ele.custnames) ,style: 'tableCell',alignment: "left" },
      { text: utils.formatNumber(ele.totalamount) ,style: 'tableCell',alignment: "right"},
      { text: utils.formatNumber(ele.paymentdetail.cashamount) ,style: 'tableCell',alignment: "right" },
      { text: utils.formatNumber(transferAmount) ,style: 'tableCell',alignment: "right"  },
      { text: utils.formatNumber(creditAmount) ,style: 'tableCell',alignment: "right"  },
    ]);
  });
  return body;
};



const pdfPreview = async (token, search,fromdate,todate, res) => {
  var dataset = await dataresult(token, search,fromdate,todate);
  var dataprofile = await dataShop(token);
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body ,dataprofile), {});
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
