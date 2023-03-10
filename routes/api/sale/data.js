const utils = require("../../../utils");
const { createClient } = require("@clickhouse/client");
const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const axios = require("axios");

const dotenv = require("dotenv");
dotenv.config();
const client = new createClient({
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB,
  connect_timeout: 60_000,
  request_timeout: 60_000,
});

const supersetUrl = "http://192.168.2.209:8088";
const username = "admin";
const password = "admin";

const dataresult = async (where, mode) => {
  var query = "";
  if (mode == "item") {
    query += "SELECT `itemcode` AS `itemcode`,";
    query += "sum(`qty`) AS `qty`,";
    query += "sum(`discountamount`) AS `discountamount`,";
    query += "sum(`sumofcost`) AS `sumofcost`,";
    query += "sum(`sumamount`) AS `sumamount`,";
    query += "(sumamount-sumofcost) AS `profit`";
    query += "FROM `dede001`.`reportsummarysale`";
    query += "WHERE  1=1 " + where;
    query += "GROUP BY `itemcode`";
    query += "ORDER BY itemcode ASC ";
  }else if (mode == "custcode") {
    query += " SELECT `custcode` AS `custcode`, ";
    query += " sum(`sumamount`) AS `sumamount` ";
    query += " FROM `dede001`.`reportsummarysale`";
    query += " WHERE 1=1 " + where;
    query += " GROUP BY `custcode`";
    query += " ORDER BY `custcode` ASC";
  }else if (mode == "warehouse") {
    query += "SELECT `whcode` AS `whcode`, ";
    query += "sum(`sumamount`) AS `sumamount` ";
    query += "FROM `dede001`.`reportsummarysale` ";
    query += "WHERE 1=1 " + where;
    query += "GROUP BY `whcode`";
    query += "ORDER BY `sumamount` DESC";
  }else if (mode == "doctype") {
    query += "SELECT `doctype` AS `doctype`, ";
    query += "sum(`sumamount`) AS `sumamount` ";
    query += "FROM `dede001`.`reportsummarysale` ";
    query += "WHERE 1=1 " + where;
    query += "GROUP BY `doctype`";
    query += "ORDER BY `sumamount` DESC";
  }else if (mode == "warehouseshelf") {
    query += "SELECT `whcode` AS `whcode`,";
    query += "`shelfcode` AS `shelfcode`,";
    query += "sum(`sumamount`) AS `sumamount`";
    query += "FROM `dede001`.`reportsummarysale`";
    query += "WHERE 1=1 " + where;
    query += "GROUP BY `whcode`,";
    query += "  `shelfcode`";
    query += "ORDER BY `sumamount` DESC";
  }

  console.log(query);
  const resultSet = await client.query({
    query: query,
    format: "JSONEachRow",
  });
  const dataset = await resultSet.json();

  return dataset;
};

// const getToken = async () => {
//   var token = "";
//   await axios
//     .post(`${supersetUrl}/api/v1/security/login`, {
//       password: password,
//       provider: "db",
//       refresh: true,
//       username: username,
//     })
//     .then((response) => {
//       token = response.data.access_token;
//       console.log("Access token:", token);
//     })
//     .catch((error) => {
//       console.error(error);
//     });

//   return token;
// };

const genPDF = async (body) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานยอดคงเหลือสินค้า ",
        style: "header",
        alignment: "center",
      },
      {
        style: "tableExample",
        table: {
          widths: ["15%", "25%", "10%", "10%", "10%", "10%", "10%", "10%"],
          body: [
            [
              { text: "รหัสสินค้า", alignment: "center" },
              { text: "ชื่อสินค้า", alignment: "center" },
              { text: "หน่วยนับ", alignment: "center" },
              { text: "คลัง", alignment: "center" },
              { text: "ที่เก็บ", alignment: "center" },
              { text: "QTY In", alignment: "center" },
              { text: "QTY Out", alignment: "center" },
              { text: "Balance", alignment: "center" },
            ],
          ],
        },
        layout: "noBorders",
      },
      {
        style: "tableExample",
        table: {
          widths: ["15%", "25%", "10%", "10%", "10%", "10%", "10%", "10%"],
          body: body,
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
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];
  dataset.forEach((ele) => {
    body.push([
      { text: ele.ic_code },
      { text: ele.ic_name },
      { text: ele.ic_unit_code, alignment: "center" },
      { text: ele.warehouse, alignment: "center" },
      { text: ele.location, alignment: "center" },
      { text: utils.formatNumber(ele.qty_in), alignment: "right" },
      { text: utils.formatNumber(ele.qty_out), alignment: "right" },
      { text: utils.formatNumber(ele.balance_qty), alignment: "right" },
    ]);
  });
  return body;
};

const pdfPreview = async (res, where) => {
  var dataset = await dataresult(where);
  var body = await genBodyPDF(dataset);
  var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
  res.setHeader("Content-Type", "application/pdf");
  pdfDoc.pipe(res);
  pdfDoc.end();
};

const pdfDownload = async (res, where) => {
  var dataset = await dataresult(where);
  var body = await genBodyPDF(dataset);
  var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="balance.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
};

const sendEmail = async (emails) => {
  try {
    var dataset = await dataresult();
    var body = await genBodyPDF(dataset);
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
