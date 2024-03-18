const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const provider = require("../../../provider");
const globalservice = require("../../../globalservice");
const dotenv = require("dotenv");
dotenv.config();

const dataresult = async (token, search, fromdate, todate,) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: [] };
  try {
    let db;
    db = client.db(process.env.MONGODB_DB);
    let filters = [];

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

    if (utils.isNotEmpty(search)) {
      filters = [];
      const pattern = new RegExp(search, "i");
      filters.push({
        $or: [
          {
            docno: { $regex: pattern },
          },

        ],
      });
    }

    filters.push({
      shopid: token,
    });


    filters.push({
      iscancel: true,
    });
    /// ซื้อสินค้า
    const transactionPurchase = db.collection("transactionPurchase");
    /// ส่งคืนสินค้า
    const transactionPurchaseReturn = db.collection("transactionPurchaseReturn");
    /// ขายสินค้า
    const transactionSaleInvoice = db.collection("transactionSaleInvoice");
    /// รับคืนสินค้า
    const transactionSaleReturn = db.collection("transactionSaleInvoiceReturn");
    /// โอนสินค้า
    const transactionTransfer = db.collection("transactionStockTransfer");
    /// รับสินค้า
    const transactionReceive = db.collection("transactionStockReceiveProduct");
    /// เบิกสินค้า
    const transactionWithdraw = db.collection("transactionStockPickupProduct");
    /// รับคืนจากการเบิก
    const transactionWithdrawReturn = db.collection("transactionStockReturnProduct");
    /// ปรับปรุงสต็อก
    const transactionStockAdjust = db.collection("transactionStockAdjustment");

    const purchaseTransactions = await transactionPurchase
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    const purchaseReturnTransactions = await transactionPurchaseReturn
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    const saleInvoices = await transactionSaleInvoice
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    const saleReturnInvoices = await transactionSaleReturn
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    const transferTransactions = await transactionTransfer
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    const receiveTransactions = await transactionReceive
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    const withdrawTransactions = await transactionWithdraw
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    const withdrawReturnTransactions = await transactionWithdrawReturn
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    const stockAdjustTransactions = await transactionStockAdjust
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();
  
    resultSet.success = true;
    resultSet.data = [...purchaseTransactions, ...purchaseReturnTransactions
      , ...saleInvoices, ...saleReturnInvoices, ...transferTransactions, ...receiveTransactions
      , ...withdrawTransactions, ...withdrawReturnTransactions, ...stockAdjustTransactions];
    const dataset = resultSet;
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
        text: "รายงานข้อมูลที่ถูกยกเลิก",
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
        widths: ['*', '*', '*', '*', '*', '*'],
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
    { text: "เอกสารวันที่", style: 'tableCell', alignment: "left" },
    { text: "เอกสารเลขที่", style: 'tableCell', alignment: "left" },
    { text: "เมนูที่ยกเลิก", style: 'tableCell', alignment: "left" },
    { text: "วันที่ยกเลิก", style: 'tableCell', alignment: "left" },
    { text: "ผู้ยกเลิก", style: 'tableCell', alignment: "left" },
    { text: "สาเหตุการยกเลิก", style: 'tableCell', alignment: "left" },

  ]),
    dataset.forEach((ele) => {
      body.push([
        { text: utils.formateDate(ele.docdatetime), style: 'tableCell', alignment: "left" },
        { text: ele.docno, style: 'tableCell', },
        { text: utils.getNameByTransflag(ele.transflag), style: 'tableCell', alignment: "left" },
        { text: utils.formateDate(ele.updatedat), style: 'tableCell', alignment: "left" },
        { text: ele.updatedby, style: 'tableCell', alignment: "left" },
        { text: "", style: 'tableCell', alignment: "left" },

      ]);
      // ele.details.forEach((detail) => {
      //   console.log(detail);

      //   body.push(
      //     [
      //       { text: detail.barcode, style: 'tableCell' },
      //       { text: utils.packName(detail.itemnames), style: 'tableCell' },
      //       { text: utils.packName(detail.whnames), style: 'tableCell', alignment: "center" },
      //       { text: utils.packName(detail.locationnames), style: 'tableCell', alignment: "center" },
      //       { text: utils.packName(detail.unitnames), style: 'tableCell', alignment: "center" },
      //       { text: utils.formatNumber(detail.qty), style: 'tableCell', alignment: "right" },
      //       { text: utils.formatNumber(detail.price), style: 'tableCell', alignment: "right" },
      //       { text: utils.formatNumber(detail.sumamount), style: 'tableCell', alignment: "right" },
      //     ]
      //   );

      // });
    });
  return body;
};



const pdfPreview = async (token, search, fromdate, todate, res) => {
  var dataset = await dataresult(token, search, fromdate, todate);
  var dataprofile = await globalservice.dataShop(token);
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
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
