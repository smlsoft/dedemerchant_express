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
    .getReport('/transaction/sale-invoice-return',token, search,fromdate,todate)
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
        text: "รายงานรับคืน/ลดหนี้",
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
        headerRows: 2,
        widths: ['8%', '13%','8%', '13%', '9%', '9%' , '8%' , '9%' , '8%' , '8%' , '8%' , '9%' ],
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
    { text: "เอกสารวันที่", style: 'tableCell',alignment: "left" },
    { text: "เอกสารเลขที่", style: 'tableCell',alignment: "left" },
    { text: "วันที่อ้างอิง", style: 'tableCell',alignment: "left" },
    { text: "เอกสารอ้างอิง", style: 'tableCell',alignment: "left" },
    { text: "เจ้าหนี้", style: 'tableCell',alignment: "left" },
    { text: "มูลค่าสินค้า", style: 'tableCell',alignment: "left" },
    { text: "มูลค่าส่วนลด", style: 'tableCell',alignment: "left" },
    { text: "หลังหักส่วนลด", style: 'tableCell',alignment: "left" },
    { text: "ยกเว้นภาษี", style: 'tableCell',alignment: "left" },
    { text: "ภาษีมูลค่าเพิ่ม", style: 'tableCell',alignment: "left" },
    { text: "มูลค่าสุทธิ", style: 'tableCell',alignment: "left" },
  ],[
    { text: "บาร์โค้ด", style: 'tableCell',alignment: "center" },
    { text: "ชื่อสินค้า", style: 'tableCell',alignment: "center" },
    { text: "คลัง", style: 'tableCell',alignment: "center" },
    { text: "พื้นที่เก็บ", style: 'tableCell',alignment: "center" },
    { text: "หน่วยนับ", style: 'tableCell',alignment: "center" },
    { text: "จำนวน", style: 'tableCell',alignment: "center" },
    { text: "ราคา", style: 'tableCell',alignment: "center" },
    { text: "ส่วนลด", style: 'tableCell',alignment: "center" },
    { text: "รวมมูลค่า", style: 'tableCell',alignment: "center" },
    { text: "", style: 'tableCell',alignment: "center" },
    { text: "", style: 'tableCell',alignment: "center" },
  ]),
  dataset.forEach((ele) => {
    body.push([
      { text: utils.formateDate(ele.docdatetime) ,style: 'tableCell',alignment: "left" ,fillColor: '#f5e8c4' },
      { text: ele.docno ,style: 'tableCell',fillColor: '#f5e8c4' },
      { text: utils.formateDate(ele.docrefdate) ,style: 'tableCell',alignment: "left" ,fillColor: '#f5e8c4' },
      { text: ele.docrefno ,style: 'tableCell',fillColor: '#f5e8c4' },
      { text: utils.packName(ele.custnames),style: 'tableCell',alignment: "left" ,fillColor: '#f5e8c4'},
      { text: utils.formatNumber(ele.totalvalue) ,style: 'tableCell',alignment: "right" ,fillColor: '#f5e8c4'},
      { text: utils.formatNumber(ele.totaldiscount) ,style: 'tableCell',alignment: "right" ,fillColor: '#f5e8c4'},
      { text: utils.formatNumber(ele.totalbeforevat) ,style: 'tableCell',alignment: "right" ,fillColor: '#f5e8c4'},
      { text: utils.formatNumber(ele.totalexceptvat) ,style: 'tableCell',alignment: "right" ,fillColor: '#f5e8c4'},
      { text: utils.formatNumber(ele.totalvatvalue),style: 'tableCell',alignment: "right"  ,fillColor: '#f5e8c4'},
      { text: utils.formatNumber(ele.totalamount),style: 'tableCell',alignment: "right" ,fillColor: '#f5e8c4' },
    ]);
    ele.details.forEach((detail) => {
   
      body.push(
        [
          { text: detail.barcode ,style: 'tableCell'},
          { text: utils.packName(detail.itemnames),style: 'tableCell' },
          { text: utils.packName(detail.whnames),style: 'tableCell',alignment: "center" },
          { text: utils.packName(detail.locationnames) ,style: 'tableCell',alignment: "center"},
          { text: utils.packName(detail.unitnames) ,style: 'tableCell',alignment: "center"},
          { text: utils.formatNumber(detail.qty) ,style: 'tableCell',alignment: "right"},
          { text: utils.formatNumber(detail.price) ,style: 'tableCell',alignment: "right"},
          { text: utils.formatNumber(detail.discountamount) ,style: 'tableCell',alignment: "right"},
          { text: utils.formatNumber(detail.sumamount),style: 'tableCell',alignment: "right" },
          { text: "" ,style: 'tableCell',alignment: "right"},
          { text: "",style: 'tableCell',alignment: "right" },
        ]
      );
    });
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
