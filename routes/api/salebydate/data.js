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
    
    console.log(resultSet.data)

    return resultSet;
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
        text: "รายงานขาย",
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
        margin: [0, 0, 0, 5],
      },
      subheader: {
        fontSize: 13,
        bold: true,
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
        widths: ["15%", "20%", "10%", "10%", "9%", "9%", "9%", "9%", "9%", "10%"],
        body: body,
      },
      layout: "lightHorizontalLines",
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];

  body.push(
    [
      { text: "เอกสารวันที่", style: "tableCell", alignment: "left" },
      { text: "เอกสารเลขที่", style: "tableCell", alignment: "left" },
      { text: "ลูกหนี้", style: "tableCell", alignment: "left" },
      { text: "มูลค่าสินค้า", style: "tableCell", alignment: "left" },
      { text: "มูลค่าส่วนลด", style: "tableCell", alignment: "left" },
      { text: "หลังหักส่วนลด", style: "tableCell", alignment: "left" },
      { text: "ยกเว้นภาษี", style: "tableCell", alignment: "left" },
      { text: "ภาษีมูลค่าเพิ่ม", style: "tableCell", alignment: "left" },
      { text: "มูลค่าสุทธิ", style: "tableCell", alignment: "left" },
    ],
    [
      { text: "บาร์โค้ด", style: "tableCell", alignment: "center" },
      { text: "ชื่อสินค้า", style: "tableCell", alignment: "center" },
      { text: "คลัง", style: "tableCell", alignment: "center" },
      { text: "พื้นที่เก็บ", style: "tableCell", alignment: "center" },
      { text: "หน่วยนับ", style: "tableCell", alignment: "center" },
      { text: "จำนวน", style: "tableCell", alignment: "center" },
      { text: "ราคา", style: "tableCell", alignment: "center" },
      { text: "ส่วนลด", style: "tableCell", alignment: "center" },
      { text: "รวมมูลค่า", style: "tableCell", alignment: "center" },
    ]
  ),
    dataset.forEach((ele) => {
      body.push([
        { text: utils.formateDate(ele.docdatetime), style: "tableCell", alignment: "left", fillColor: "#f5e8c4" },
        { text: ele.docno, style: "tableCell", fillColor: "#f5e8c4" },
        { text: utils.packName(ele.custnames), style: "tableCell", alignment: "left", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totalvalue), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totaldiscount), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totalbeforevat), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totalexceptvat), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totalvatvalue), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
        { text: utils.formatNumber(ele.totalamount), style: "tableCell", alignment: "right", fillColor: "#f5e8c4" },
      ]);
      ele.details.forEach((detail) => {
        console.log(detail);
        body.push([
          { text: detail.barcode, style: "tableCell" },
          { text: utils.packName(detail.itemnames), style: "tableCell" },
          { text: utils.packName(detail.whnames), style: "tableCell", alignment: "center" },
          { text: utils.packName(detail.locationnames), style: "tableCell", alignment: "center" },
          { text: utils.packName(detail.unitnames), style: "tableCell", alignment: "center" },
          { text: utils.formatNumber(detail.qty), style: "tableCell", alignment: "right" },
          { text: utils.formatNumber(detail.price), style: "tableCell", alignment: "right" },
          { text: utils.formatNumber(detail.discountamount), style: "tableCell", alignment: "right" },
          { text: utils.formatNumber(detail.sumamount), style: "tableCell", alignment: "right" },
        ]);
      });
    });
  return body;
};

const pdfPreview = async (token, search, fromdate, todate, res) => {
  var dataset = await salebydate(token, search, fromdate, todate);
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
  var dataset = await salebydate(token, search);
  var body = await genBodyPDF(dataset.data);
  var pdfDoc = printer.createPdfKitDocument(await genPDF(body), {});
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="balance.pdf"');
  pdfDoc.pipe(res);
  pdfDoc.end();
};

module.exports = { salebydate, genPDF, pdfPreview, pdfDownload, receivemoney };
