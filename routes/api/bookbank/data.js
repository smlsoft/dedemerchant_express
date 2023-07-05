const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const globalservice = require("../../../globalservice");
const dotenv = require("dotenv");
const provider = require("../../../provider");
dotenv.config();


const dataresult = async (token, search) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: [] };
  try {
    let db;
    db = client.db(process.env.MONGODB_DB);
    let filters = [];

  
    if (utils.isNotEmpty(search)) {
      filters = [];
      const pattern = new RegExp(search, "i");
      filters.push({
        $or: [
      
          {
            bankcode: { $regex: pattern },
          },
          {
            passbook: { $regex: pattern },
          },
          {
            names: {
              $elemMatch: {
                name: { $regex: pattern },
              },
            },
          },
          {
            banknames: {
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
   
    const data = db.collection("bookBank");

    const result = await data
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

const genPDF = async (body,dataprofile) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานสมุดบัญชี",
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
      }
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 1,
        widths: ['20%', '35%', '20%', '25%' ],
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
    { text: "รหัส", alignment: "center" },
    { text: "ธนาคาร", alignment: "center" },
    { text: "หมายเลขสมุดบัญชี", alignment: "center" },
    { text: "ชื่อเจ้าของบัญชี", alignment: "center" },
  ]),
  dataset.forEach((ele) => {
    body.push([
      { text: ele.passbook,alignment: "center"  },
      { text: utils.packName(ele.banknames) },
      { text: ele.bankcode, alignment: "center" },
      { text: utils.packName(ele.names) }
    ]);
  });
  return body;
};



const pdfPreview = async (token, search, res) => {
  var dataset = await dataresult(token, search);
  var dataprofile = await globalservice.dataShop(token);
  
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body ,dataprofile), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  }else {
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
