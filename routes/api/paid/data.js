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
const dataresult = async (shopid, fromdate, todate, printby, fromcustcode, tocustcode, branchcode, search) => {
  const pg = await provider.connectPG();
  let where = "WHERE 1=1"; // Default WHERE clause
  var res = { success: false, data: [], msg: "" };

  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += ` AND docdate BETWEEN '${fromdate} 00:00:00' AND '${todate} 23:59:59'`;
  } else if (utils.isNotEmpty(fromdate)) {
    where += ` AND docdate >= '${fromdate} 00:00:00'`;
  } else if (utils.isNotEmpty(todate)) {
    where += ` AND docdate <= '${todate} 23:59:59'`;
  } else {
    where += '';
  }


  if (utils.isNotEmpty(fromcustcode) && utils.isNotEmpty(tocustcode)) {
    where += ` AND custcode BETWEEN '${fromcustcode}' AND '${tocustcode}'`;
  } else if (utils.isNotEmpty(fromcustcode)) {
    where += ` AND custcode = '${fromcustcode}'`;
  } else if (utils.isNotEmpty(tocustcode)) {
    where += ` AND custcode = '${tocustcode}'`;
  }

  if (utils.isNotEmpty(branchcode)) {
    where += ` AND branchcode = '${branchcode}'`;
  }


  if (utils.isNotEmpty(search)) {
    where += ` AND (custcode LIKE '%${search}%' OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(custnames) AS element
      WHERE element LIKE '%${search}%'
    ))`;
  }

  var query = `
    SELECT 
      date(docdate) AS doc_date,
      TO_CHAR(docdate + INTERVAL '7 hours', 'HH24:MI') AS doc_time,
      docno,
      custcode,
      custnames,
      totalamount,
      roundamount,
      (totalamount + roundamount) AS totalvalue,
      paycashamount,
      summoneytransfer,
      sumcreditcard,
      sumcheque,
      sumcoupon,
      sumqrcode,
      sumcredit,
      (paycashamount + summoneytransfer + sumcreditcard + sumcheque + sumcoupon + sumqrcode + sumcredit) AS total_payment,
      branchcode,
      branchnames
    FROM 
      payment_transaction 
    ${where}
    ORDER BY 
      docdate, docno
  `;


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

const genPDF = async (body, dataprofile, fromdate, todate, printby, fromcustcode, tocustcode, branchcode) => {
  var custcodeText = "";
  var branchText = "";
  if (utils.isNotEmpty(fromcustcode) && utils.isNotEmpty(tocustcode)) {
    custcodeText = `ลูกค้า : ${fromcustcode} ถึง ${tocustcode}`;
  } else if (utils.isNotEmpty(fromcustcode)) {
    custcodeText = `ลูกค้า : ${fromcustcode}`;
  } else if (utils.isNotEmpty(tocustcode)) {
    custcodeText = `ลูกค้า : ${tocustcode}`;
  }

  if (utils.isNotEmpty(branchcode)) {
    branchText = `สาขา : ${branchcode}`;
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
          text: "จากวันที่ : " + utils.formateDate(fromdate) + " ถึงวันที่ : " + utils.formateDate(todate) + " " + custcodeText + " " + branchText,
          style: "subheader",
          alignment: "center",
          /// margin: [left, top, right, bottom]
          margin: [10, 0, 10, 10],

        },
        {
          alignment: "justify",
          columns: [
            {
              text: "หัวข้อ : รายงานการรับเงิน",
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
        widths: ["10%", "10%", "11%", "7%", "7%", "6%", "6%", "6%", "6%", "6%", "6%", "6%", "6%", "7%"],
        body: body,

      },
      layout: {
        hLineWidth: function (i, node) {
          if (i === 0) return 1;
          if (i === 1) return 1;
          if (i === body.length - 1) return 1;
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

const genBodyPDF = async (dataset, showsumbydate) => {
  let body = [];
  let currentDate = "";
  let currentSubtotals = resetSubtotals();
  let mainSumTotal = resetSubtotals();

  // Define the header row for the table
  body.push([
    { text: "เอกสารวันที่/เวลา", style: "tableHeader", alignment: "center" },
    { text: "เอกสารเลขที่", style: "tableHeader", alignment: "left" },
    { text: "ลูกหนี้", style: "tableHeader", alignment: "center" },
    { text: "มูลค่าสุทธิ", style: "tableHeader", alignment: "center" },
    { text: "ปัดเศษ", style: "tableHeader", alignment: "center" },
    { text: "รวมมูลค่า", style: "tableHeader", alignment: "center" },
    { text: "เงินสด", style: "tableHeader", alignment: "center" },
    { text: "เงินโอน", style: "tableHeader", alignment: "center" },
    { text: "บัตรเครดิต", style: "tableHeader", alignment: "center" },
    { text: "เช็ค", style: "tableHeader", alignment: "center" },
    { text: "คูปอง", style: "tableHeader", alignment: "center" },
    { text: "คิวอาร์โค้ด", style: "tableHeader", alignment: "center" },
    { text: "เครดิต", style: "tableHeader", alignment: "center" },
    { text: "รวมยอดเงิน", style: "tableHeader", alignment: "center" },
  ]);

  // Iterate through each dataset entry
  dataset.forEach((ele, index) => {
    const formattedDate = utils.formateDate(ele.doc_date);
    if (currentDate && currentDate !== formattedDate && showsumbydate == 1) {
      // Add subtotal row for the previous date
      addSubtotalRow(body, currentDate, currentSubtotals);
      currentSubtotals = resetSubtotals(); // Reset subtotals for the new date
    }

    currentDate = formattedDate; // Update the current date

    // Process the current row
    processDataRow(ele, body, currentSubtotals);

    // add main sum total
    mainSumTotal.totalAmount += parseFloat(ele.totalamount);
    mainSumTotal.roundAmount += parseFloat(ele.roundamount);
    mainSumTotal.totalValue += parseFloat(ele.totalvalue);
    mainSumTotal.payCashAmount += parseFloat(ele.paycashamount);
    mainSumTotal.sumMoneyTransfer += parseFloat(ele.summoneytransfer);
    mainSumTotal.sumCreditCard += parseFloat(ele.sumcreditcard);
    mainSumTotal.sumCheque += parseFloat(ele.sumcheque);
    mainSumTotal.sumCoupon += parseFloat(ele.sumcoupon);
    mainSumTotal.sumQrcode += parseFloat(ele.sumqrcode);
    mainSumTotal.sumCredit += parseFloat(ele.sumcredit);
    mainSumTotal.totalPayment += parseFloat(ele.total_payment);


    // For the last item in the dataset, add the subtotal row
    if (index === dataset.length - 1 && showsumbydate == 1) {
      addSubtotalRow(body, currentDate, currentSubtotals);
    }
  });

  // Add overall totals row at the end
  addOverallTotalRow(body, mainSumTotal);

  return body;
};

function resetSubtotals() {
  return {
    totalValue: 0,
    roundAmount: 0,
    totalAmount: 0,
    payCashAmount: 0,
    sumMoneyTransfer: 0,
    sumCreditCard: 0,
    sumCheque: 0,
    sumCoupon: 0,
    sumQrcode: 0,
    sumCredit: 0,
    totalPayment: 0,
  };
}

function processDataRow(ele, body, subtotals) {
  // Adjust ele.paycashchange if necessary
  ele.paycashchange = ele.paycashchange || 0;

  // Add data row to body
  body.push([
    // Your data row cells here
    { text: `${utils.formateDate(ele.doc_date)} ${ele.doc_time}`, style: "tableCell", alignment: "center" },
    { text: ele.docno, style: "tableCell", alignment: "center" },
    { text: utils.packName(ele.custnames), style: "tableCell", alignment: "left" },
    { text: utils.formatNumber(ele.totalvalue), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.roundamount), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.totalamount), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.paycashamount), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.summoneytransfer), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sumcreditcard), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sumcheque), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sumcoupon), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sumqrcode), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sumcredit), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.total_payment), style: "tableCell", alignment: "right" },
  ]);

  // Update subtotals 
  subtotals.totalValue += parseFloat(ele.totalvalue);
  subtotals.roundAmount += parseFloat(ele.roundamount);
  subtotals.totalAmount += parseFloat(ele.totalamount);
  subtotals.payCashAmount += parseFloat(ele.paycashamount);
  subtotals.sumMoneyTransfer += parseFloat(ele.summoneytransfer);
  subtotals.sumCreditCard += parseFloat(ele.sumcreditcard);
  subtotals.sumCheque += parseFloat(ele.sumcheque);
  subtotals.sumCoupon += parseFloat(ele.sumcoupon);
  subtotals.sumQrcode += parseFloat(ele.sumqrcode);
  subtotals.sumCredit += parseFloat(ele.sumcredit);
  subtotals.totalPayment += parseFloat(ele.total_payment);
}



function addSubtotalRow(body, date, subtotals) {
  body.push([
    { text: `ยอดรวมวันที่ ${date}`, colSpan: 3, style: "tableFooter", alignment: "right" }, {}, {},
    { text: utils.formatNumber(subtotals.totalValue), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.roundAmount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.totalAmount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.payCashAmount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.sumMoneyTransfer), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.sumCreditCard), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.sumCheque), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.sumCoupon), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.sumQrcode), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.sumCredit), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(subtotals.totalPayment), style: "tableFooter", alignment: "right" },

  ]);
}

function addOverallTotalRow(body, totals) {
  body.push([
    { text: "รวม", style: "tableFooter", alignment: "right", colSpan: 3 }, {}, {},
    { text: utils.formatNumber(totals.totalAmount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.roundAmount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.totalValue), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.payCashAmount), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.sumMoneyTransfer), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.sumCreditCard), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.sumCheque), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.sumCoupon), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.sumQrcode), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.sumCredit), style: "tableFooter", alignment: "right" },
    { text: utils.formatNumber(totals.totalPayment), style: "tableFooter", alignment: "right" },
  ]);
}


const pdfPreview = async (shopid, fromdate, todate, printby, showsumbydate, fromcustcode, tocustcode, branchcode, search, res) => {
  var dataset = await dataresult(shopid, fromdate, todate, printby, fromcustcode, tocustcode, branchcode, search);
  var dataprofile = await globalservice.dataShop(shopid);
  // console.log(dataset);
  // console.log(dataprofile);
  if (dataset.success && dataprofile.success) {
    var body = await genBodyPDF(dataset.data, showsumbydate);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, fromcustcode, tocustcode, branchcode), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const genDownLoadPaidPDF = async (fileName, shopid, fromdate, todate, printby, showsumbydate, fromcustcode, tocustcode, branchcode, search) => {
  console.log("processing");
  var dataset = await dataresult(shopid, fromdate, todate, printby, fromcustcode, tocustcode, branchcode, search);
  var dataprofile = await globalservice.dataShop(shopid);

  if (dataset.success) {
    try {
      var body = await genBodyPDF(dataset.data, showsumbydate);
      var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, fromcustcode, tocustcode, branchcode), {});
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



module.exports = { dataresult, genPDF, pdfPreview, genDownLoadPaidPDF };
