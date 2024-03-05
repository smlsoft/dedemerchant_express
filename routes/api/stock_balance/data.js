const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const provider = require("../../../provider");
const globalservice = require("../../../globalservice");
const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs");
const os = require("os");
const path = require("path");

const dataresult = async (shopid, fromdate, todate, barcode) => {
  const pg = await provider.connectPG();
  let where = `WHERE std.shopid =  '${shopid}'`;
  var res = { success: false, data: [], msg: "" };

  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += ` AND st.docdate BETWEEN '${fromdate} 00:00:00' AND '${todate} 23:59:59'`;
  } else if (utils.isNotEmpty(fromdate)) {
    where += ` AND st.docdate >= '${fromdate} 00:00:00'`;
  } else if (utils.isNotEmpty(todate)) {
    where += ` AND st.docdate <= '${todate} 23:59:59'`;
  } else {
    where += '';
  }

  if (utils.isNotEmpty(barcode)) {
    where += ` AND std.barcode = '${barcode}'`;

  }


  var query = `
  select DISTINCT ON (std.barcode)
  std.barcode,pd.names AS item_name
  ,std.wh_code,std.location_code,pd.unitnames AS unit_name
  ,round(coalesce(std.balanceqty,0),2) as balance_qty
  ,round(coalesce(std.balanceaverage,0),2) as average_cost
  ,round(coalesce(std.balanceamount,0),2) as balance_amount
  from stock_transaction_detail as std
  left join stock_transaction as st on st.shopid = std.shopid and st.docno = std.docno
  left join productbarcode as pd on pd.shopid = std.shopid and pd.barcode = std.barcode
  ${where}
  order by std.barcode,st.docdate desc
  `;

  console.log(query);


  try {
    await pg.connect();

    const result = await pg.query(query);
    res.success = true;
    res.data = result.rows;
    return res;
  } catch (error) {
    console.log(error);
    res.msg = error.message;
    return res;
  } finally {
    await pg.end();
  }
};


const genBodyPDF = async (dataset, showcost) => {
  let body = [];

  let sum_balance = 0;
  let sum_total_balance = 0;

  /// 0 ไม่แสดงต้นทุน
  /// 1 แสดงต้นทุน
  if (showcost == 0) {
    body.push([
      { text: "Barcode", style: "tableHeader", alignment: "center" },
      { text: "ชื่อสินค้า", style: "tableHeader", alignment: "center" },
      { text: "หน่วยนับ", style: "tableHeader", alignment: "center" },
      { text: "จำนวนคงเหลือ", style: "tableHeader", alignment: "center" },
    ]);

    dataset.forEach((ele, index) => {
      body.push([
        { text: ele.barcode, style: "tableCell", alignment: "left" },
        { text: utils.packName(ele.item_name), style: "tableCell", alignment: "left" },
        { text: utils.packName(ele.unit_name), style: "tableCell", alignment: "left" },
        { text: utils.formatNumber(ele.balance_qty), style: "tableCell", alignment: "right" },
      ]);

      sum_balance += parseFloat(ele.balance_qty);

    });

    body.push([
      { text: "รวม", style: "tableFooter", alignment: "left" },
      {},
      {},
      { text: utils.formatNumber(sum_balance), style: "tableFooter", alignment: "right" },
    ]);

  } else if (showcost == 1) {
    body.push([
      { text: "Barcode", style: "tableHeader", alignment: "center" },
      { text: "ชื่อสินค้า", style: "tableHeader", alignment: "center" },
      { text: "หน่วยนับ", style: "tableHeader", alignment: "center" },
      { text: "จำนวนคงเหลือ", style: "tableHeader", alignment: "center" },
      { text: "ต้นทุนเฉลี่ย", style: "tableHeader", alignment: "center" },
      { text: "มูลค่าคงเหลือ", style: "tableHeader", alignment: "center" },
    ]);

    dataset.forEach((ele, index) => {
      body.push([
        { text: ele.barcode, style: "tableCell", alignment: "left" },
        { text: utils.packName(ele.item_name), style: "tableCell", alignment: "left" },
        { text: utils.packName(ele.unit_name), style: "tableCell", alignment: "left" },
        { text: utils.formatNumber(ele.balance_qty), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.average_cost), style: "tableCell", alignment: "right" },
        { text: utils.formatNumber(ele.balance_amount), style: "tableCell", alignment: "right" },
      ]);

      sum_balance += parseFloat(ele.balance_qty);
      sum_total_balance += parseFloat(ele.balance_amount);

    });

    body.push([
      { text: "รวม", style: "tableFooter", alignment: "left" },
      {},
      {},
      { text: utils.formatNumber(sum_balance), style: "tableFooter", alignment: "right" },
      {},
      { text: utils.formatNumber(sum_total_balance), style: "tableFooter", alignment: "right" },



    ]);

  }

  return body;
};

const genPDF = async (body, dataprofile, fromdate, todate, printby, showcost, barcode) => {
  var barcodeText = "";
  let tableWidths = [];

  if (showcost == 0) {
    tableWidths = ["15%", "35%", "25%", "25%"];
  } else if (showcost == 1) {
    tableWidths = ["10%", "30%", "15%", "15%", "15%", "15%"];

  }

  if (utils.isNotEmpty(barcode)) {
    barcodeText = " , รหัสสินค้า : " + barcode;

  }

  var docDefinition = {
    header: function (currentPage, pageCount, pageSize) {
      return [
        {
          text: dataprofile.data.name1,
          style: "header",
          alignment: "center",
          /// margin: [left, top, right, bottom]
          margin: [10, 10, 10, 0],

        },
        {
          text: "จากวันที่ : " + utils.formateDate(fromdate) + " ถึงวันที่ : " + utils.formateDate(todate) + barcodeText,
          style: "subheader",
          alignment: "center",
          /// margin: [left, top, right, bottom]
          margin: [10, 0, 10, 10],

        },
        {
          alignment: "justify",
          columns: [
            {
              text: "หัวข้อ : รายงานสินค้าคงเหลือ",
              style: "subheader",
              alignment: "left",
              margin: [10, 0, 0, 0],
            },
            {
              text: "หน้า : " + currentPage + "/" + pageCount,
              style: "subheader",
              alignment: "right",
              margin: [0, 0, 10, 0],
            },
          ],
        },
        {
          alignment: "justify",
          columns: [
            {
              text: "พิมพ์โดย : " + printby,
              style: "subheader",
              alignment: "left",
              margin: [10, 0, 0, 0],
            },
            {
              text: "วันที่พิมพ์ : " + utils.formateDateTimeNow(new Date()),
              style: "subheader",
              alignment: "right",
              margin: [0, 0, 10, 0],
            },
          ],
        },
      ];
    },
    content: [],
    pageOrientation: "landscape",
    pageMargins: [10, 80, 10, 10], // [left, top, right, bottom]
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
        fontSize: 9,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      tableHeader: {
        fontSize: 8,
        bold: true,
      },
      tableCell: {
        fontSize: 7,
      },
      tableFooter: {
        fontSize: 8,
        bold: true,
      },
    },
  };

  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 1,
        widths: tableWidths,
        body: body,

      },
      layout: {
        hLineWidth: function (i, node) {
          if (i === 0) return 1;
          if (i === 1) return 1;
          // if (i === body.length - 1) return 1;
          if (i === body.length) return 1;
          return null;
        },
        vLineWidth: function (i, node) {
          return i === 0 || i === node.table.widths.length ? 0 : 0;
          return null;
        },

      },
    });
  }
  return docDefinition;
};


const genDownLoadStockBalancePDF = async (fileName, shopid, fromdate, todate, printby, showcost, barcode) => {
  console.log("processing");
  var dataset = await dataresult(shopid, fromdate, todate, barcode);
  var dataprofile = await globalservice.dataShop(shopid);

  if (dataset.success) {
    try {
      var body = await genBodyPDF(dataset.data, showcost);
      var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, showcost, barcode), {});
      const tempPath = path.join(os.tmpdir(), fileName);

      const writeStream = fs.createWriteStream(tempPath);

      pdfDoc.pipe(writeStream);

      pdfDoc.end();

      writeStream.on("error", function (err) {
        console.error("Error writing PDF to file:", err);
      });

      writeStream.on("finish", function () {
        console.log(`PDF written to ${tempPath}`);
      });
    } catch (err) {
      console.log(err);
    }
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const pdfPreview = async (shopid, fromdate, todate, printby, showcost, barcode, res) => {
  var dataset = await dataresult(shopid, fromdate, todate, barcode);
  var dataprofile = await globalservice.dataShop(shopid);
  // console.log(dataprofile);
  console.log(dataset);
  if (dataset.success && dataprofile.success) {
    var body = await genBodyPDF(dataset.data, showcost);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, showcost, barcode), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

module.exports = { dataresult, pdfPreview, genDownLoadStockBalancePDF };
