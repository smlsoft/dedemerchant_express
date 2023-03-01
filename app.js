const express = require("express");
var bodyParser = require("body-parser");
const path = require("path");
var nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const logger = require("./logger");
const e = require("express");
const pdfMake = require("pdfmake");
const { createClient } = require("@clickhouse/client");
const Numeral = require("numeral");
const { Kafka,Partitioners } = require('kafkajs');
const client = new createClient({
  host: "http://192.168.2.49:18123",
  username: "smlchdb",
  password: "smlchdb",
  database: "dede001",
});



const kafka = new Kafka({
  clientId: 'my-app2',
  brokers: ['192.168.2.49:9093']
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner
});
const consumer = kafka.consumer({ groupId: 'my-group' });

const app = express();
const fonts = {
  Sarabun: {
    normal: path.join(__dirname, "fonts", "Sarabun-Regular.ttf"),
    bold: path.join(__dirname, "fonts", "Sarabun-Medium.ttf"),
    italics: path.join(__dirname, "fonts", "Sarabun-Italic.ttf"),
    bolditalics: path.join(__dirname, "fonts", "Sarabun-MediumItalic.ttf"),
  },
};

const PdfPrinter = require("pdfmake");
const printer = new PdfPrinter(fonts);
const fs = require("fs");

app.use(express.static(path.join(__dirname, "public")));
app.set("port", process.env.PORT || 3333);
app.use(bodyParser.json({ limit: "200mb" }));
app.use(bodyParser.urlencoded({ limit: "200mb", extended: true }));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

//app.use(logger);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));



app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.post('/messages', async (req, res) => {

  try {
    await producer.connect();
    await producer.send({
      topic: 'my-topic2',
      messages: [{ value: 'Hello KafkaJS user!' },]
    });
    await producer.disconnect();
    console.log('Send message:', ' From Kafka');
    res.status(200).send('Message sent to Kafka');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error sending message to Kafka');
  }
});

// Receive messages from a Kafka topic
app.get('/messages', async (req, res) => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'my-topic2', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ message }) => {
    
        console.log('Received message:', message.value.toString());
        var docDefinition = {
          content: [
            {
              text: "รายงานยอดคงเหลือ",
              style: "header",
              alignment: "center",
            },
            {
              style: "tableExample",
              table: {
                widths: ["40%", "40%", "20%"],
                body: [
                  [
                    { text: "รหัส" },
                    { text: "ชื่อ" },
                    {
                      text: "จำนวน",
                      bold: false,
                      alignment: "center",
                    },
                  ],
                ],
              },
              layout: "noBorders",
            },
            {
              style: "tableExample",
              table: {
                widths: ["40%", "40%", "20%"],
                body: [
                  [
                    { text: "1000001" },
                    { text: "โค้ก" },
                    {
                      text: "10",
                      bold: false,
                      alignment: "right",
                    },
                  ],
                  [
                    { text: "1000002" },
                    { text: "มาม่า" },
                    {
                      text: "100",
                      bold: false,
                      alignment: "right",
                    },
                  ],
                  [
                    { text: "1000003" },
                    { text: "ขนมเลย์" },
                    {
                      text: "20",
                      bold: false,
                      alignment: "right",
                    },
                  ],
                  [
                    { text: "1000004" },
                    { text: "ทดสอบ" },
                    {
                      text: "50",
                      bold: false,
                      alignment: "right",
                    },
                  ],
                  [
                    { text: "1000005" },
                    { text: "ทดสอบ2" },
                    {
                      text: "90",
                      bold: false,
                      alignment: "right",
                    },
                  ],
                ],
              },
              layout: "noBorders",
            },
          ],
          pageOrientation: "portrait",
          pageMargins: [40, 8, 40, 8],
          defaultStyle: {
            font: "Sarabun",
            fontSize: 11,
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
        var options = {
          // ...
        };
      
        var pdfDoc = printer.createPdfKitDocument(docDefinition, options);
      
        pdfDoc.end();
      
        let transporter = nodemailer.createTransport({
          host: "in-v3.mailjet.com",
          secure: false,
          port: 587,
          auth: {
            user: "b2df5aa9f49e7a5e97ea88036158266d",
            pass: "f4c4d6b7ea6cf9c311c0fceccc7f935f",
          },
        });
        var i = 0;
      
        setTimeout(function () {
          // var datas = req.body[i].data;
          var email = "fishphatuna@gmail.com";
      
          var name = "fish";
      
          console.log("sending email..." + email + " - " + (i + 1));
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
          transporter.sendMail(HelperOptions, (error, info) => {
            console.log(info);
            if (error) {
              return console.log("error " + error);
            }
            res.json({ output: "The message was sent!", message: info });
            console.log("The message was sent!");
            console.log(info);
          });
      
          console.log("sending email done");
          i++;
          // if (i < req.body.length) {
          //   myLoop();
          // }
        }, 1500);
      }
    });

    res.status(200).send('Listening for messages from Kafka');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error receiving messages from Kafka');
  }
});

app.get("/datach", async (req, res) => {
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

  // Execute the query and fetch the data
  const resultSet = await client.query({
    query: query,
    format: "JSONEachRow",
  });
  const dataset = await resultSet.json();
  console.log(dataset);
});

app.use("/api/products", require("./routes/api/products"));

app.get("/pdfview", async (req, res) => {
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

  // Execute the query and fetch the data
  const resultSet = await client.query({
    query: query,
    format: "JSONEachRow",
  });
  const dataset = await resultSet.json();
  console.log(dataset);
  let body = [];
  dataset.forEach((ele) => {
    body.push([
      { text: ele.ic_code },
      { text: ele.ic_name },
      { text: ele.ic_unit_code, alignment: "center" },
      { text: ele.warehouse, alignment: "center" },
      { text: ele.location, alignment: "center" },
      { text: formatNumber(ele.qty_in), alignment: "right" },
      { text: formatNumber(ele.qty_out), alignment: "right" },
      { text: formatNumber(ele.balance_qty), alignment: "right" },
    ]);
  });
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
  var options = {
    // ...
  };

  var pdfDoc = printer.createPdfKitDocument(docDefinition, options);

  // Set the content type and filename for the response
  res.setHeader("Content-Type", "application/pdf");

  pdfDoc.pipe(res);
  pdfDoc.end();
});
const formatNumber = (val, digit = 0) => {
  if (val == 0) {
    return "0.00";
  } else if (val < 0) {
    return Numeral(val).format("(0,0.00)");
  } else {
    return Numeral(val).format("0,0.00");
  }
};
app.get("/pdf", (req, res) => {
  var docDefinition = {
    content: [
      {
        text: "บัญชีชุดที่ " + "\n งบดุล \n ณ วันที่ ",
        style: "header",
        alignment: "center",
      },
      {
        style: "tableExample",
        table: {
          widths: ["40%", "40%", "20%"],
          body: [
            [
              { text: "001" },
              { text: "ทดสอบ" },
              {
                text: "100",
                bold: false,
                alignment: "right",
              },
            ],
            [
              { text: "001" },
              { text: "ทดสอบ" },
              {
                text: "100",
                bold: false,
                alignment: "right",
              },
            ],
            [
              { text: "001" },
              { text: "ทดสอบ" },
              {
                text: "100",
                bold: false,
                alignment: "right",
              },
            ],
            [
              { text: "001" },
              { text: "ทดสอบ" },
              {
                text: "100",
                bold: false,
                alignment: "right",
              },
            ],
            [
              { text: "001" },
              { text: "ทดสอบ" },
              {
                text: "100",
                bold: false,
                alignment: "right",
              },
            ],
          ],
        },
        layout: "noBorders",
      },
    ],
    pageOrientation: "portrait",
    pageMargins: [40, 8, 40, 8],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 12,
      columnGap: 20,
      color: "#0A065D",
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
  var options = {
    // ...
  };

  var pdfDoc = printer.createPdfKitDocument(docDefinition, options);

  // Set the content type and filename for the response
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');

  pdfDoc.pipe(res);
  pdfDoc.end();
});

app.get("/sendMail", function (req, res) {
  var docDefinition = {
    content: [
      {
        text: "รายงานยอดคงเหลือ",
        style: "header",
        alignment: "center",
      },
      {
        style: "tableExample",
        table: {
          widths: ["40%", "40%", "20%"],
          body: [
            [
              { text: "รหัส" },
              { text: "ชื่อ" },
              {
                text: "จำนวน",
                bold: false,
                alignment: "center",
              },
            ],
          ],
        },
        layout: "noBorders",
      },
      {
        style: "tableExample",
        table: {
          widths: ["40%", "40%", "20%"],
          body: [
            [
              { text: "1000001" },
              { text: "โค้ก" },
              {
                text: "10",
                bold: false,
                alignment: "right",
              },
            ],
            [
              { text: "1000002" },
              { text: "มาม่า" },
              {
                text: "100",
                bold: false,
                alignment: "right",
              },
            ],
            [
              { text: "1000003" },
              { text: "ขนมเลย์" },
              {
                text: "20",
                bold: false,
                alignment: "right",
              },
            ],
            [
              { text: "1000004" },
              { text: "ทดสอบ" },
              {
                text: "50",
                bold: false,
                alignment: "right",
              },
            ],
            [
              { text: "1000005" },
              { text: "ทดสอบ2" },
              {
                text: "90",
                bold: false,
                alignment: "right",
              },
            ],
          ],
        },
        layout: "noBorders",
      },
    ],
    pageOrientation: "portrait",
    pageMargins: [40, 8, 40, 8],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 11,
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
  var options = {
    // ...
  };

  var pdfDoc = printer.createPdfKitDocument(docDefinition, options);

  pdfDoc.end();

  let transporter = nodemailer.createTransport({
    host: "in-v3.mailjet.com",
    secure: false,
    port: 587,
    auth: {
      user: "b2df5aa9f49e7a5e97ea88036158266d",
      pass: "f4c4d6b7ea6cf9c311c0fceccc7f935f",
    },
  });
  var i = 0;

  setTimeout(function () {
    // var datas = req.body[i].data;
    var email = "fishphatuna@gmail.com";

    var name = "fish";

    console.log("sending email..." + email + " - " + (i + 1));
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
    transporter.sendMail(HelperOptions, (error, info) => {
      console.log(info);
      if (error) {
        return console.log("error " + error);
      }
      res.json({ output: "The message was sent!", message: info });
      console.log("The message was sent!");
      console.log(info);
    });

    console.log("sending email done");
    i++;
    // if (i < req.body.length) {
    //   myLoop();
    // }
  }, 1500);

  res.json({ output: "success", message: "done" });
  //
});

app.get("/healthcheck", (req, res) => {
  res.status(200).send("OK");
});


const sendMail = (param1, param2) => {
  // Function body goes here
};


app.listen(app.get("port"), function () {
  console.log("run at port", app.get("port"));
});
