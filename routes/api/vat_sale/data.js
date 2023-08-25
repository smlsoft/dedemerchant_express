const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const globalservice = require("../../../globalservice");
const provider = require("../../../provider");
const dotenv = require("dotenv");
dotenv.config();

const dataresult = async (token, year, month) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: [] };
  try {
    let db;
    db = client.db(process.env.MONGODB_DB);
    let filters = [];

    filters.push({
      shopid: token,
    });
    filters.push({
      taxdocno: { $ne: "" },
    });
    if (utils.isNotEmpty(year) && utils.isNotEmpty(month)) {
      const firstDayMonth = new Date(parseInt(year), parseInt(month), 1, 0, 0, 0, 0);
      const lastDayMonth = new Date(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59, 999);

      console.log(`First day of ${month} ${year}:`, firstDayMonth);
      console.log(`Last day of ${month} ${year}:`, lastDayMonth);
      filters.push({
        taxdocdate: {
          $gte: firstDayMonth,
        },
      });
      filters.push({
        taxdocdate: {
          $lt: lastDayMonth,
        },
      });
    }

    const transactionPaid = db.collection("transactionSaleInvoice");

    const result = await transactionPaid
      .aggregate([
        {
          $lookup: {
            from: "debtors",
            localField: "custcode",
            foreignField: "code",
            as: "debtor",
          },
        },
        {
          $unwind: {
            path: "$debtor",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unionWith: {
            coll: "transactionSaleInvoiceReturn",
          },
        },
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
    // console.log(dataset.data);
    return dataset;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

const genPDF = async (body, dataprofile, year, month, type) => {
  var company = await globalservice.dataCompany(dataprofile.data.guidfixed);
  var companyResult = { names: [], taxID: "", branchNames: [] };
  if (company.data.body != null) {
    companyResult = JSON.parse(company.data.body);
  }

  // console.log(companyResult);
  const monthsThai = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var currentMonthName = "";
  if (parseInt(type) == 1) {
    currentMonthName = monthsThai[parseInt(month)];
  } else {
    currentMonthName = monthsThai[parseInt(month)];
  }

  var docDefinition = {
    header: function (currentPage, pageCount, pageSize) {
      return { text: "หน้าที่ " + currentPage + "/" + pageCount, alignment: "right", margin: [0, 5, 5, 0], style: "tableCell" };
    },
    content: [
      {
        text: "รายงานภาษีขาย",
        style: "header",
        alignment: "center",
      },
      {
        text: type == parseInt(0) ? "เดือนภาษี " + currentMonthName + " ปี " + parseInt(year) : "เดือนภาษี " + currentMonthName + " ปี " + (parseInt(year) + 543),
        style: "subheader2",
        alignment: "center",
      },
      {
        alignment: "justify",
        columns: [
          {
            text: "ชื่อผู้ประกอบการ: " + companyResult.names.find((ele) => ele.code == "th").name,
            style: "subheader2",
            alignment: "left",
          },
          {
            text: "เลขประจำตัวผู้เสียภาษี: " + companyResult.taxID,
            style: "subheader2",
            alignment: "right",
          },
        ],
      },
      {
        alignment: "justify",
        columns: [
          {
            width: "*",
            text: "ชื่อสถานประกอบการ: " + companyResult.names.find((ele) => ele.code == "th").name,
            style: "subheader2",
            alignment: "left",
          },
          {
            width: "40%",
            columns: [
              {
                width: "5%",
                margin: [0, 4, 0, 0],
                canvas: [
                  {
                    type: "polyline",
                    lineWidth: 1,
                    closePath: true,
                    points: [
                      { x: 0, y: 0 },
                      { x: 8, y: 0 },
                      { x: 8, y: 8 },
                      { x: 0, y: 8 },
                    ],
                    color: companyResult.branchNames.find((ele) => ele.code == "th").name == "" ? "#000" : "",
                  },
                ],
                alignment: "right",
              },
              {
                width: "28%",
                text: "สำนักงานใหญ่",
                style: "subheader2",
                alignment: "left",
              },
              {
                width: "5%",
                margin: [0, 4, 0, 0],
                canvas: [
                  {
                    type: "polyline",
                    lineWidth: 1,
                    closePath: true,
                    points: [
                      { x: 0, y: 0 },
                      { x: 8, y: 0 },
                      { x: 8, y: 8 },
                      { x: 0, y: 8 },
                    ],
                    color: companyResult.branchNames.find((ele) => ele.code == "th").name != "" ? "#000" : "",
                  },
                ],
                alignment: "right",
              },
              {
                width: "*",
                text:
                  companyResult.branchNames.find((ele) => ele.code == "th").name != ""
                    ? "สาขา: " + companyResult.branchNames.find((ele) => ele.code == "th").name
                    : "สาขา ..........................................",
                style: "subheader2",
                alignment: "left",
              },
            ],
          },
        ],
      },
      {
        alignment: "justify",
        columns: [
          {
            text: "ที่อยู่: " + companyResult.addresses.find((ele) => ele.code == "th").name,
            style: "subheader2",
            alignment: "left",
          },
        ],
      },
    ],
    pageOrientation: "landscape",
    pageMargins: [10, 20, 10, 10], // [left, top, right, bottom]
    defaultStyle: {
      font: "Sarabun",
      fontSize: 12,
      columnGap: 10,
      color: "#000",
    },
    styles: {
      header: {
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 2],
      },
      subheader: {
        fontSize: 11,
        bold: false,
        margin: [0, 0, 0, 2],
      },
      subheader2: {
        fontSize: 11,
        bold: false,
        margin: [0, 0, 0, 2],
      },
      tableCell: {
        fontSize: 9,
      },
      tableFooter: {
        fontSize: 10,
        bold: true,
      },
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 1,
        widths: ["3%", "7%", "13%", "13%", "10%", "10%", "11%", "8%", "9%", "8%", "8%"],
        body: body,
      },
      layout: {
        fillColor: function (rowIndex, node, columnIndex) {
          if (rowIndex === 0) return "#EFEFEF"; // Header color
          if (rowIndex === body.length - 1) return "#EFEFEF"; // Footer color
          return null;
        },
      },
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];
  var olddoc = "";
  var idx = 1;
  var sumTotalAmount = 0;
  var sumTotalValue = 0;
  var sumTotalExceptVat = 0;
  var sumTotalVatValue = 0;
  body.push([
    { text: "ลำดับ", style: "tableCell", alignment: "center" },
    { text: "วันที่ใบกำกับ", style: "tableCell", alignment: "center" },
    { text: "เลขที่ใบกำกับ", style: "tableCell", alignment: "center" },
    { text: "เลขที่เอกสาร", style: "tableCell", alignment: "center" },
    { text: "ชื่อผู้ประกอบการ", style: "tableCell", alignment: "center" },
    { text: "สถานประกอบการ", style: "tableCell", alignment: "center" },
    { text: "เลขผู้เสียภาษี", style: "tableCell", alignment: "center" },
    { text: "รวมมูลค่าสินค้า/บริการ", style: "tableCell", alignment: "center" },
    { text: "มูลค่ายกเว้นภาษี", style: "tableCell", alignment: "center" },
    { text: "มูลค่าสินค้า/บริการ", style: "tableCell", alignment: "center" },
    { text: "จำนวนภาษี", style: "tableCell", alignment: "center" },
  ]),
    dataset.forEach((ele) => {
      if (olddoc != ele.docno) {
        let custType = 1;
        let taxID = 1;
        let btancNum = 1;
        if (ele.debtor != undefined && ele.debtor != "undefined" && ele.debtor != null) {
          custType = ele.debtor.customertype;
          taxID = ele.debtor.taxid;
          btancNum = ele.debtor.branchnumber;
        }
        sumTotalAmount = sumTotalAmount + ele.totalamount;
        sumTotalExceptVat = sumTotalExceptVat + ele.totalexceptvat;
        sumTotalVatValue = sumTotalVatValue + ele.totalvatvalue;
        sumTotalValue = sumTotalValue + ele.totalvalue;
        body.push([
          { text: idx, style: "tableCell", alignment: "center" },
          { text: utils.formateDate(ele.taxdocdate), style: "tableCell", alignment: "center" },
          { text: ele.taxdocno, style: "tableCell" },
          { text: ele.docno, style: "tableCell" },
          { text: utils.packName(ele.custnames), style: "tableCell", alignment: "left" },
          { text: custType == 1 ? "สำนักงานใหญ่" : btancNum, style: "tableCell" },
          { text: taxID, style: "tableCell" },
          { text: utils.formatNumber(ele.totalamount), style: "tableCell", alignment: "right" },
          { text: utils.formatNumber(ele.totalexceptvat), style: "tableCell", alignment: "right" },
          { text: utils.formatNumber(ele.totalvalue), style: "tableCell", alignment: "right" },
          { text: utils.formatNumber(ele.totalvatvalue), style: "tableCell", alignment: "right" },
        ]);
        idx = idx + 1;
      }
      olddoc = ele.docno;
    });
  body.push([
    { text: "รวม", style: "tableFooter", alignment: "center", colSpan: 7 },
    {},
    {},
    {},
    {},
    {},
    {},
    { text: utils.formatNumber(sumTotalAmount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(sumTotalExceptVat), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(sumTotalValue), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(sumTotalVatValue), style: "tableFooter", alignment: "right" },
  ]);

  return body;
};

const pdfPreview = async (token, year, month, type, res) => {
  var dataset = await dataresult(token, year, month);
  var dataprofile = await globalservice.dataShop(token);

  // console.log(dataset);
  // console.log(dataprofile);
  if (dataset.success && dataprofile.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, year, month, type), {});
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

module.exports = { dataresult, genPDF, pdfPreview, pdfDownload };
