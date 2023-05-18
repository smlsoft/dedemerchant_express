const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const service = require("./service");


const dotenv = require("dotenv");
dotenv.config();

const dataresult = async (token) => {
var resultSet ={success: false, data:null} ;
  await service.getProductBarcode(token)
  .then((res) => {
    //console.log(res);
    if (res.success) {
     console.log(res.data)
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
          widths: ["25%", "25%", "25%", "25%"],
          body: [
            [
              { text: "บาร์โค้ด", alignment: "center" },
              { text: "รหัสสินค้า", alignment: "center" },
              { text: "ชื่อสินค้า", alignment: "center" },
              { text: "หน่วยนับ", alignment: "center" },
            ],
          ],
        },
        layout: "noBorders",
      },
      {
        style: "tableExample",
        table: {
          widths: ["25%", "25%", "25%", "25%"],
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
      { text: ele.barcode },
      { text: ele.itemcode },
      { text: packName(ele.names) },
      { text: ele.itemunitcode, alignment: "center" },
    ]);
  });
  return body;
};

const packName = (names)=>{
  var result = "";
  for (var i = 0; i < names.length; i++) {
    if (names[i].name != '') {
      result += names[i].name;
      if (i < names.length - 1) {
        result += ",";
      }
    }
  }
  return result;
}

const pdfPreview = async (token,res) => {
  var dataset = await dataresult(token);
  
  if(dataset.success){
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  }
};

const pdfDownload = async (token,res) => {
  var dataset = await dataresult(token);
  var body = await genBodyPDF(dataset.data);
  var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="balance.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
};

const sendEmail = async (token,emails) => {
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
    emails.forEach( (email, index) => {
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
