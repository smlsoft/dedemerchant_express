const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const provider = require("../../../provider");
const globalservice = require("../../../globalservice");
const dotenv = require("dotenv");
dotenv.config();

const salebydate = async (token, search, fromdate, todate) => {
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
          {
            custname: {
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

    const data = db.collection("transactionSaleInvoice");

    const result = await data
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
        {
          $sort: {
            docdatetime: -1,
          },
        },
      ])
      .toArray();
    resultSet.success = true;

    const dataset = Array.from(
      result.reduce((acc, { docdatetime, detailtotalamount, totaldiscount, totalexceptvat, totalbeforevat, totalvatvalue, totalamount }) => {
        const dateKey = utils.extractDate(docdatetime);

        if (!acc.has(dateKey)) {
          acc.set(dateKey, {
            docdatetime: dateKey,
            detailtotalamount: 0,
            totaldiscount: 0,
            totalexceptvat: 0,
            totalbeforevat: 0,
            totalvatvalue: 0,
            totalamount: 0,
          });
        }

        acc.get(dateKey).detailtotalamount += detailtotalamount;
        acc.get(dateKey).totaldiscount += totaldiscount;
        acc.get(dateKey).totalexceptvat += totalexceptvat;
        acc.get(dateKey).totalbeforevat += totalbeforevat;
        acc.get(dateKey).totalvatvalue += totalvatvalue;
        acc.get(dateKey).totalamount += totalamount;

        return acc;
      }, new Map())
    ).map(([_, value]) => value);

    console.log(dataset);
    resultSet.data = dataset;
    return resultSet;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

const receivemoney = async (token, search, fromdate, todate) => {
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
          {
            custname: {
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

    const data = db.collection("transactionSaleInvoice");

    const result = await data
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
        {
          $sort: {
            docdatetime: -1,
          },
        },
      ])
      .toArray();
    resultSet.success = true;
    const aggregatedData = result.reduce((acc, item) => {

      const date = utils.extractDate(item.docdatetime);

      if (!acc[date]) {
        acc[date] = {
          cashAmount: 0,
          creditAmount: 0,
          transferAmount: 0,
          couponAmount: 0,
          chequeAmount: 0,
          totalAmount: 0
        };
      }

      // Aggregate the values
      acc[date].cashAmount += item.paycashamount - item.paycashchange;
      acc[date].creditAmount += item.sumcreditcard;
      acc[date].transferAmount += item.summoneytransfer;
      acc[date].couponAmount += item.sumcoupon;
      acc[date].chequeAmount += item.sumcheque;
      acc[date].totalAmount += item.totalamountafterdiscount;

      return acc;
    }, {});


    resultSet.data = Object.entries(aggregatedData).map(([date, data]) => ({
      date,
      data
    }));

   // console.log(resultSet.data)

    return resultSet;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

const genPDF = async (body, dataprofile, fromdate, todate) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานยอดขายตามวัน",
        style: "header",
        alignment: "center",
      },
      {
        text: dataprofile.data.name1,
        style: "subheader",
        alignment: "center",
      },
      {
        text: "วันที่ " + utils.formateDate(fromdate) + " - " + utils.formateDate(todate),
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
        margin: [0, 0, 0, 5],
      },
      subheader: {
        fontSize: 10,
        bold: false,
        margin: [0, 0, 0, 10],
      },
      tableCell: {
        fontSize: 9,
      },
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 2,
        widths: ["14%", "16%", "14%", "14%", "14%", "14%", "14%"],
        body: body,
      },
      layout: "lightHorizontalLines",
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];
  let totaldetailtotalamount = 0;
  let totaltotaldiscount = 0;
  let totaltotalexceptvat = 0;
  let totaltotalbeforevat = 0;
  let totaltotalvatvalue = 0;
  let totaltotalamount = 0;


  body.push(
    [
      { text: "วันที่", style: "tableCell", alignment: "left", bold: true },
      { text: "รวมมูลค่า", style: "tableCell", alignment: "left", bold: true },
      { text: "รวมส่วนลดทั้งสิ้น", style: "tableCell", alignment: "left", bold: true },
      { text: "ยอดยกเว้นภาษี", style: "tableCell", alignment: "left", bold: true },
      { text: "ยอดก่อนภาษี", style: "tableCell", alignment: "left", bold: true },
      { text: "ยอดภาษี", style: "tableCell", alignment: "left", bold: true },
      { text: "มูลค่าสุทธิ", style: "tableCell", alignment: "left", bold: true },
    ]
  ),
    dataset.forEach((ele) => {
      totaldetailtotalamount += ele.detailtotalamount;
      totaltotaldiscount += ele.totaldiscount;
      totaltotalexceptvat += ele.totalexceptvat;
      totaltotalbeforevat += ele.totalbeforevat;
      totaltotalvatvalue += ele.totalvatvalue;
      totaltotalamount += ele.totalamount;

      body.push([
        { text: utils.formateDate(ele.docdatetime), style: "tableCell", alignment: "left" },
        { text: utils.formatNumber(ele.detailtotalamount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.totaldiscount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.totalexceptvat), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.totalbeforevat), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.totalvatvalue), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.totalamount), style: "tableCell", alignment: "right" },
      ]);
    });

  body.push(
    [
      { text: "รวม", style: "tableCell", alignment: "left", bold: true },
      { text: utils.formatNumber(totaldetailtotalamount), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totaltotaldiscount), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totaltotalexceptvat), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totaltotalbeforevat), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totaltotalvatvalue), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totaltotalamount), style: "tableCell", alignment: "right", bold: true },
    ]
  );

  return body;
};


const genPDFReceivemoney = async (body, dataprofile, fromdate, todate) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานรับเงินตามวันที่",
        style: "header",
        alignment: "center",
      },
      {
        text: dataprofile.data.name1,
        style: "subheader",
        alignment: "center",
      },
      {
        text: "วันที่ " + utils.formateDate(fromdate) + " - " + utils.formateDate(todate),
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
        margin: [0, 0, 0, 5],
      },
      subheader: {
        fontSize: 10,
        bold: false,
        margin: [0, 0, 0, 10],
      },
      tableCell: {
        fontSize: 9,
      },
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 2,
        widths: ["14%", "14%", "14%", "14%", "14%", "14%", "14%"],
        body: body,
      },
      layout: "lightHorizontalLines",
    });
  }
  return docDefinition;
};

const genBodyPDFReceivemoney = async (dataset) => {
  let body = [];
  let totalcashAmount = 0;
  let totalcreditAmount = 0;
  let totaltransferAmount = 0;
  let totalcouponAmount = 0;
  let totalchequeAmount = 0;
  let totaltotalAmount = 0;

  body.push(
    [
      { text: "วันที่", style: "tableCell", alignment: "left", bold: true },
      { text: "เงินสด", style: "tableCell", alignment: "left", bold: true },
      { text: "เครดิต", style: "tableCell", alignment: "left", bold: true },
      { text: "เงินโอน", style: "tableCell", alignment: "left", bold: true },
      { text: "คูปอง", style: "tableCell", alignment: "left", bold: true },
      { text: "เช็ค", style: "tableCell", alignment: "left", bold: true },
      { text: "รวมเงินทั้งสิน", style: "tableCell", alignment: "left", bold: true },
    ]
  ),
    dataset.forEach((ele) => {
      totalcashAmount += ele.data.cashAmount;
      totalcreditAmount += ele.data.creditAmount;
      totaltransferAmount += ele.data.transferAmount;
      totalcouponAmount += ele.data.couponAmount;
      totalchequeAmount += ele.data.chequeAmount;
      totaltotalAmount += ele.data.totalAmount;

      body.push([
        { text: utils.formateDate(ele.date), style: "tableCell", alignment: "left" },
        { text: utils.formatNumber(ele.data.cashAmount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.data.creditAmount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.data.transferAmount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.data.couponAmount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.data.chequeAmount), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.data.totalAmount), style: "tableCell", alignment: "right" },
      ]);
    });

  body.push(
    [
      { text: "รวม", style: "tableCell", alignment: "left", bold: true },
      { text: utils.formatNumber(totalcashAmount), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totalcreditAmount), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totaltransferAmount), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totalcouponAmount), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totalchequeAmount), style: "tableCell", alignment: "right", bold: true },
      { text: utils.formatNumber(totaltotalAmount), style: "tableCell", alignment: "right", bold: true },
    ]
  );

  return body;
};




const pdfPreview = async (token, search, fromdate, todate, res) => {
  var dataset = await salebydate(token, search, fromdate, todate);
  var dataprofile = await globalservice.dataShop(token);
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const pdfPreviewReceivemoney = async (token, search, fromdate, todate, res) => {
  var dataset = await receivemoney(token, search, fromdate, todate);
  var dataprofile = await globalservice.dataShop(token);
  if (dataset.success) {
    var body = await genBodyPDFReceivemoney(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDFReceivemoney(body, dataprofile, fromdate, todate), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const pdfDownload = async (token, search, fromdate, todate, res) => {
  var dataset = await salebydate(token, search, fromdate, todate);
  var dataprofile = await globalservice.dataShop(token);

  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate), {});

    // Generate a filename using fromdate and todate
    const filename = `sale_by_date_${fromdate}-${todate}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};


module.exports = { salebydate, genPDF, pdfPreview, pdfDownload, receivemoney, pdfPreviewReceivemoney };
