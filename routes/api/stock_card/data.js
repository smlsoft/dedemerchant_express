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
const { Double } = require("mongodb");

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
    where += ` AND pd.mainbarcoderef = '${barcode}'`;
  }


  var query = `
      select pd.mainbarcoderef as barcode,date(st.docdate) as doc_date,st.transflag as trans_flag,std.docno
      ,std.wh_code,std.location_code,pd.unitnames
      ,case when std.calcflag = 1 then round(coalesce((std.qty*pd.standvalue)/pd.dividevalue,0),2) else 0 end as qty_in
      ,case when std.calcflag = 1 then round(coalesce(std.costperunit,0),2) else 0 end as average_cost_in
      ,case when std.calcflag = 1 then round(coalesce(std.totalcost,0),2) else 0 end as balance_in
      ,case when std.calcflag = -1 then round(coalesce((std.qty*pd.standvalue)/pd.dividevalue,0),2) else 0 end as qty_out
      ,case when std.calcflag = -1 then round(coalesce(std.costperunit,0),2) else 0 end as average_cost_out
      ,case when std.calcflag = -1 then round(coalesce(std.totalcost,0),2) else 0 end as balance_out
      ,round(coalesce(std.balanceqty,0),2) as balance_qty
      ,round(coalesce(std.balanceaverage,0),2) as average_cost
      ,round(coalesce(std.balanceamount,0),2) as balance_amount
      from stock_transaction_detail as std
      left join stock_transaction as st on st.shopid = std.shopid and st.docno = std.docno
      left join productbarcode as pd on pd.shopid = std.shopid and pd.barcode = std.barcode
      ${where}
      order by pd.mainbarcoderef,std.wh_code,std.location_code,st.docdate
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


const genBodyPDF = async (dataset) => {
  let body = [];

  let sum_qty_in = 0;
  let sum_qty_out = 0;
  let sum_balance_in = 0;
  let sum_balance_out = 0;

  let sum_balance_amount = 0;


  body.push([
    { text: "เอกสารวันที่", style: "tableHeader", alignment: "center" },
    { text: "ประเภทเอกสาร", style: "tableHeader", alignment: "center" },
    { text: "เลขที่เอกสาร", style: "tableHeader", alignment: "center" },
    { text: "คลัง", style: "tableHeader", alignment: "center" },
    { text: "พื้นที่เก็บ", style: "tableHeader", alignment: "center" },
    { text: "หน่วยนับ", style: "tableHeader", alignment: "center" },
    { text: "จำนวนเพิ่ม", style: "tableHeader", alignment: "center" },
    { text: "ต้นทุนเพิ่ม", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าเพิ่ม", style: "tableHeader", alignment: "center" },
    { text: "จำนวนลด", style: "tableHeader", alignment: "center" },
    { text: "ต้นทุนลด", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าลด", style: "tableHeader", alignment: "center" },
    { text: "จำนวนคงเหลือ", style: "tableHeader", alignment: "center" },
    { text: "ต้นทุนคงเหลือ", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าคงเหลือ", style: "tableHeader", alignment: "center" },
  ]);

  dataset.forEach((ele, index) => {
    body.push([
      { text: utils.formateDate(ele.doc_date), style: "tableCell", alignment: "left" },
      { text: utils.getNameByTransflag(ele.trans_flag), style: "tableCell", alignment: "left" },
      { text: ele.docno, style: "tableCell", alignment: "left" },
      { text: ele.wh_code, style: "tableCell", alignment: "left" },
      { text: ele.location_code, style: "tableCell", alignment: "left" },
      { text: ele.unitname, style: "tableCell", alignment: "left" },
      { text: utils.formatNumber(ele.qty_in), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.average_cost_in), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.balance_in), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.qty_out), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.average_cost_out), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.balance_out), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.balance_qty), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.average_cost), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.balance_amount), style: "tableCell", alignment: "right" },
    ]);

    sum_qty_in += parseFloat(ele.qty_in);
    sum_qty_out += parseFloat(ele.qty_out);
    sum_balance_in += parseFloat(ele.balance_in);
    sum_balance_out += parseFloat(ele.balance_out);

  });

  body.push([
    { text: "รวม", style: "tableFooter", alignment: "left", colSpan: 6 },
    {},
    {},
    {},
    {},
    {},
    { text: utils.formatNumber(sum_qty_in), style: "tableFooter", alignment: "right" },
    {},
    { text: utils.formatNumber(sum_balance_in), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(sum_qty_out), style: "tableFooter", alignment: "right" },
    {},
    { text: utils.formatNumber(sum_balance_out), style: "tableFooter", alignment: "right" },
    {},
    {},
    {},


  ]);



  return body;
};

const genPDF = async (body, dataprofile, fromdate, todate, printby, barcode) => {
  var barcodeText = "";
  let tableWidths = [];


  tableWidths = ["6%", "8%", "9%", "5%", "5%", "5%", "6%", "6%", "7%", "7%", "7%", "7%", "8%", "7%", "7%"];



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
              text: "หัวข้อ : รายงานบัญชีคุมพิเศษ",
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


const genDownLoadStockCardPDF = async (fileName, shopid, fromdate, todate, printby, barcode) => {
  console.log("processing");
  var dataset = await dataresult(shopid, fromdate, todate, barcode);
  var dataprofile = await globalservice.dataShop(shopid);

  if (dataset.success) {
    try {
      var body = await genBodyPDF(dataset.data);
      var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, barcode), {});
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

const pdfPreview = async (shopid, fromdate, todate, printby, barcode, res) => {
  var dataset = await dataresult(shopid, fromdate, todate, barcode);
  var dataprofile = await globalservice.dataShop(shopid);
  // console.log(dataprofile);
  console.log(dataset);
  if (dataset.success && dataprofile.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, barcode), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

module.exports = { dataresult, pdfPreview, genDownLoadStockCardPDF };
