const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const service = require("./service");

const dotenv = require("dotenv");
dotenv.config();

const dataShop = async (token) => {
  var resultSet = { success: false, data: [] };
  await service
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

const dataresult = async (token, search) => {
  var resultSet = { success: false, data: [] };
  await service
    .getProductBarcode(token, search)
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

  const dataset = await resultSet;
  console.log(dataset);
  return dataset;
};



const genPDF = async (body, dataprofile) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานสินค้า ",
        style: "header",
        alignment: "center",
      },
      {
        text: dataprofile.data.name1,
        style: "header",
        alignment: "center",
      },
    ],
    pageOrientation: "landscape",
    pageMargins: [10, 10, 30, 10], // [left, top, right, bottom]
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
      }
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 1,
        widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
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
    { text: "บาร์โค้ด", alignment: "center" },
    { text: "ชื่อสินค้า", alignment: "center" },
    { text: "หน่วยนับ", alignment: "center" },
    { text: "รหัสสินค้า", alignment: "center" },
    { text: "ประเภทสินค้า", alignment: "center" },
    { text: "ประเภทภาษี", alignment: "center" },
    { text: "ราคาขายปลีก", alignment: "right" },
    { text: "ราคาสมาชิค", alignment: "right" },
    { text: "ราคาขายลู่", alignment: "right" },
  ]),
    dataset.forEach((ele) => {

      body.push([
        { text: ele.barcode },
        { text: utils.packName(ele.names) },
        { text: ele.itemunitcode, alignment: "center" },
        { text: ele.itemcode, alignment: "center" },
        { text: ele.itemtype, alignment: "center" },
        { text: ele.vattype, alignment: "center" },
        { text: prices(ele.prices,1), alignment: "right" },
        { text: prices(ele.prices,2), alignment: "right" },
        { text: prices(ele.prices,3), alignment: "right" },
      ]);
    });
  return body;
};

const prices = (prices,key) => {
  var result = "";
  prices.forEach(ele => {
    if(ele.keynumber == key){
      result = ele.price;
    }
  });
  return result;
};

const pdfPreview = async (token, search, res) => {
  var dataset = await dataresult(token, search);
  var dataprofile = await dataShop(token);

  if (dataset.success) {
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
  var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="balance.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
};

const sendEmail = async (token, emails) => {
  try {
    var dataset = await dataresult(token);
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
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
