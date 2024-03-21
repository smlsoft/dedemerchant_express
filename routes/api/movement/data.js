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


  if (utils.isNotEmpty(barcode)) {
    where += ` AND std.barcode = '${barcode}'`;

  }


  var query = `
      select barcode,case when sort = 1 then null else doc_date end as doc_date
      ,case when sort = 1 then null else trans_flag end as trans_flag
      ,docno,wh_code,location_code,unit_name,qty_in,qty_out,balance_qty
      from(select * 
      from(select 1 as sort,std.barcode,date('1900-01-01') as doc_date,0 as trans_flag,'ยกมา' as docno
      ,'' as wh_code,'' as location_code
      ,'' AS unit_name
      ,0 as qty_in
      ,0 as qty_out
      ,round(coalesce(sum(std.qty*std.calcflag),0),2) as balance_qty
      from stock_transaction_detail as std
      left join stock_transaction as st on st.shopid = std.shopid and st.docno = std.docno
      left join productbarcode as pd on pd.shopid = std.shopid and pd.barcode = std.barcode
      ${where}
      and st.docdate < '${fromdate} 00:00:00'
      group by std.barcode
      order by std.barcode
      ) as temp1

      union all

      select *
      from(select 2 as sort,std.barcode,date(st.docdate) as doc_date,st.transflag as trans_flag,std.docno
      ,std.wh_code,std.location_code
      ,pd.unitnames[0]->>'name' AS unit_name
      ,case when std.calcflag = 1 then round(coalesce(std.qty,0),2) else 0 end as qty_in
      ,case when std.calcflag = -1 then round(coalesce(std.qty,0),2) else 0 end as qty_out
      ,0 as balance_qty
      from stock_transaction_detail as std
      left join stock_transaction as st on st.shopid = std.shopid and st.docno = std.docno
      left join productbarcode as pd on pd.shopid = std.shopid and pd.barcode = std.barcode
      ${where}
      and st.docdate between '${fromdate} 00:00:00' and '${todate} 23:59:59'
      order by std.barcode,st.docdate
      ) as temp2
      ) as final_table
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
  let sum_balance_amount = 0;


  body.push([
    { text: "เอกสารวันที่", style: "tableHeader", alignment: "center" },
    { text: "ประเภทเอกสาร", style: "tableHeader", alignment: "center" },
    { text: "เลขที่เอกสาร", style: "tableHeader", alignment: "center" },
    { text: "คลัง", style: "tableHeader", alignment: "center" },
    { text: "พื้นที่เก็บ", style: "tableHeader", alignment: "center" },
    { text: "หน่วยนับ", style: "tableHeader", alignment: "center" },
    { text: "จำนวนเพิ่ม", style: "tableHeader", alignment: "center" },
    { text: "จำนวนลด", style: "tableHeader", alignment: "center" },
    { text: "ยอดคงเหลือ", style: "tableHeader", alignment: "center" },
  ]);

  dataset.forEach((ele , index) => {
    sum_balance_amount = (ele.docno === "ยกมา") ? ele.balance_qty : (parseFloat(sum_balance_amount) + parseFloat(dataset[index].qty_in)) - parseFloat(dataset[index].qty_out);

    body.push([
      { text: (ele.docno !== "ยกมา") ? utils.formateDate(ele.doc_date) : "", style: "tableCell", alignment: "left" },
      { text: (ele.docno !== "ยกมา") ? utils.getNameByTransflag(ele.trans_flag) : "", style: "tableCell", alignment: "left" },
      { text: ele.docno, style: "tableCell", alignment: "left", style: (ele.docno !== "ยกมา") ? "tableCell" : "tableHeader" },
      { text: ele.wh_code, style: "tableCell", alignment: "left" },
      { text: ele.location_code, style: "tableCell", alignment: "left" },
      { text: ele.unitname, style: "tableCell", alignment: "left" },
      { text: utils.formatNumber(ele.qty_in), style: "tableCell", alignment: "right" },
      { text: utils.formatNumber(ele.qty_out), style: "tableCell", alignment: "right" },
      { text: (ele.docno === "ยกมา") ? utils.formatNumber(ele.balance_qty) : utils.formatNumber(sum_balance_amount), style: (ele.docno !== "ยกมา") ? "tableCell" : "tableHeader", alignment: "right" },
    ]);

    sum_qty_in += parseFloat(ele.qty_in);
    sum_qty_out += parseFloat(ele.qty_out);

  });

  body.push([
    { text: "รวม", style: "tableFooter", alignment: "left", colSpan: 6 },
    {},
    {},
    {},
    {},
    {},
    { text: utils.formatNumber(sum_qty_in), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(sum_qty_out), style: "tableFooter", alignment: "right" },
    {},
  ]);



  return body;
};

const genPDF = async (body, dataprofile, fromdate, todate, printby, barcode) => {
  var barcodeText = "";
  let tableWidths = [];


  tableWidths = ["10%", "15%", "15%", "10%", "10%", "10%", "10%", "10%", "10%"];

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
              text: "หัวข้อ : รายงานเคลื่อนไหวสินค้า",
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


const genDownLoadMovementPDF = async (fileName, shopid, fromdate, todate, printby, barcode) => {
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

module.exports = { dataresult, pdfPreview, genDownLoadMovementPDF };
