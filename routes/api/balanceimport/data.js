const utils = require("../../../utils");
const { createClient } = require("@clickhouse/client");
const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");

const dotenv = require("dotenv");
dotenv.config();
const client = new createClient({
  host: process.env.CH_SERVER_ADDRESS,
  username: process.env.CH_USERNAME,
  password: process.env.CH_PASSWORD,
  database: process.env.CH_DATABASE_NAME,
});

const query = `select shopid,ic_code,warehouse,location, ic_name, ic_unit_code
, qty_in/unitstandard_ratio as qty_in
, qty_out/unitstandard_ratio as qty_out
, balance_qty/unitstandard_ratio as balance_qty
 from (select case when COALESCE(p2.qtydivide,0) = 0 then 1 else coalesce(p2.qtystand/p2.qtydivide,1) end as unitstandard_ratio,
 temp1.shopid,temp1.ic_code,temp1.warehouse,temp1.location, temp1.ic_name, temp1.balance_qty, temp1.ic_unit_code
 , temp1.qty_in, temp1.qty_out
 from (select t.shopid as shopid,t.itemcode as ic_code,t.whcode as warehouse,t.shelfcode as location, arrayFirst(x -> x != '', p.names) as ic_name
 , p.unitstandard as ic_unit_code
 , coalesce(sum(t.calcflag*(case when ((t.doctype in (70,54,60,58,310,12) or (t.doctype=66 and t.qty>0) or (t.doctype=14 and t.inquirytype=0) or (t.doctype=48 and t.inquirytype < 2))
 or (t.doctype in (56,68,72,44) or (t.doctype=66 and t.qty<0) or (t.doctype=46 and t.inquirytype in (0,2)) or (t.doctype=16 and t.inquirytype in (0,2))
 or (t.doctype=311 and t.inquirytype=0)) )
 then t.qty*(t.standvalue / t.dividevalue) else 0 end)),0) as balance_qty
 , sum(case when (t.doctype in (70,54,60,58,310,12) or (t.doctype=66 and t.qty>0) or (t.doctype=14 and t.inquirytype=0) or (t.doctype=48 and t.inquirytype < 2))
 then t.calcflag*(t.qty*(t.standvalue/t.dividevalue)) else 0 end) as qty_in
 , -1*sum(case when (t.doctype in (56,68,72,44) or (t.doctype=66 and t.qty<0) or (t.doctype=46 and t.inquirytype in (0,2))
 or (t.doctype=16 and t.inquirytype in (0,2)) or (t.doctype=311 and t.inquirytype=0)) then t.calcflag*(t.qty*(t.standvalue/t.dividevalue)) else 0 end) as qty_out
 from dede001.transdetail t
 left join dede001.product p on p.shopid=t.shopid and p.code=t.itemcode
 where t.laststatus=0 and t.itemtype not in (1,3,5) and date(t.docdatetime)<='2023-12-31'
 and t.itemcode = '007001' --and t.whcode in ('B01','DC01')
 group by t.itemcode, t.whcode, t.shelfcode, t.shopid, p.names, p.unitstandard
 ) as temp1
 left join dede001.productunit p2 on temp1.shopid=p2.shopid and p2.iccode=temp1.ic_code and p2.unitcode=temp1.ic_unit_code
where (qty_in<>0 or qty_out<>0 or balance_qty<>0) /*and ic_code between '3062001' and '3062001'*/
) as final
order by shopid,ic_code,warehouse,location`;

const dataresult = async () => {
  const resultSet = await client.query({
    query: query,
    format: "JSONEachRow",
  });
  const dataset = await resultSet.json();
  console.log(dataset);
  return dataset;
};

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

const pdfPreview = async (res) => {
  var dataset = await dataresult();
  var body = await genBodyPDF(dataset);
  var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
  res.setHeader("Content-Type", "application/pdf");
  pdfDoc.pipe(res);
  pdfDoc.end();
};

const pdfDownload = async (res) => {
  var dataset = await dataresult();
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
