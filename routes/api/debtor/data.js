const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const service = require("./service");

const dotenv = require("dotenv");
dotenv.config();

const dataresult = async (token, search) => {
  var resultSet = { success: false, data: null };
  await service
    .getDebtorReport(token, search)
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

const genPDF = async (body) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานสินค้า ",
        style: "header",
        alignment: "center",
      },
      {
        style: "tableExample",
        table: {
          widths: ["16%", "16%", "16%", "16%", "16%", "16%"],
          body: [
            [
              { text: "รหัส" },
              { text: "ชื่อ" },
              { text: "หมายเลขโทรศัพท์" },
              { text: "ที่อยุ่" },

              { text: "เบอร์โทร" },
              { text: "ประเภทลูกหนี้" },
            ],
          ],
        },
        layout: "noBorders",
      },
    ],
    pageOrientation: "landscape",
    pageMargins: [40, 8, 40, 8],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 12,
      columnGap: 20,
      color: "#000",
    },
    styles: {
      header: {
        bold: true,
      },
      textdecoration: {
        italics: true,
        alignment: "right",
        decoration: "underline",
        decorationStyle: "double",
      },
      margindetail: {
        margin: [20, 0, 0, 0],
      },
      margintotal: {
        margin: [50, 0, 0, 0],
      },
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        widths: ["16%", "16%", "16%", "16%", "16%", "16%"],
        body: body,
      },
      layout: "noBorders",
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];

  dataset.forEach((ele) => {
    body.push([
      { text: ele.code },
      { text: packName(ele.names) },
      { text: ele.taxid },
      {
        text:
          ele.addressforbilling.countrycode +
          ele.addressforbilling.provincecode +
          ele.addressforbilling.districtcode +
          ele.addressforbilling.subdistrictcode +
          ele.addressforbilling.zipcode +
          ele.addressforbilling.phoneprimary +
          ele.addressforbilling.phonesecondary,
      },
      { text: ele.addressforbilling.phoneprimary },
      { text: ele.addressforbilling.phoneprimary },
    ]);
  });
  return body;
};

const packName = (names) => {
  var result = "";
  for (var i = 0; i < names.length; i++) {
    if (names[i].name != "") {
      result += names[i].name;
      if (i < names.length - 1) {
        result += ",";
      }
    }
  }
  return result;
};

const pdfPreview = async (token, search, res) => {
  var dataset = await dataresult(token, search);

  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
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
