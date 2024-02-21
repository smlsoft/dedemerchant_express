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
const dataresult = async (shopid, fromdate, todate, printby, branchcode) => {
  const pg = await provider.connectPG();
  let where = `WHERE shopid =  '${shopid}'`;
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

  if (utils.isNotEmpty(branchcode)) {
    where += ` AND branchcode = '${branchcode}'`;
  }

  var query = `
    SELECT 
      date(docdate) AS doc_date
      ,sum(totalamount) as total_amount,sum(roundamount) as round_amount
      ,(sum(totalamount)+sum(roundamount)) as total_value
      ,sum(paycashamount) as pay_cashamount,sum(summoneytransfer) as sum_transfer
      ,sum(sumcreditcard) as sum_creditcard,sum(sumcheque) as sum_cheque
      ,sum(sumcoupon) as sum_coupon,sum(sumqrcode) as sum_qrcode,sum(sumcredit) as sum_credit
      ,sum(paycashamount+summoneytransfer+sumcreditcard+sumcheque+sumcoupon+sumqrcode+sumcredit) as total_payment
    FROM 
      payment_transaction 
    ${where}
    GROUP BY 
      doc_date
    ORDER BY 
      doc_date
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

const genPDF = async (body, dataprofile, fromdate, todate, printby, branchcode) => {
  var custcodeText = "";
  var branchText = "";


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
              text: "หัวข้อ : รายงานการรับเงิน ตามวัน",
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
        widths: ["10%", "8%", "8%", "8%", "8%", "8%", "8%", "8%", "8%", "8%", "8%", "10%"],
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
  let mainSumTotal = resetSubtotals();

  // Define the header row for the table
  body.push([
    { text: "เอกสารวันที่", style: "tableHeader", alignment: "left" },
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

    // Process the current row
    processDataRow(ele, body);

    // add main sum total
    mainSumTotal.totalAmount += parseFloat(ele.total_amount);
    mainSumTotal.roundAmount += parseFloat(ele.round_amount);
    mainSumTotal.totalValue += parseFloat(ele.total_value);
    mainSumTotal.payCashAmount += parseFloat(ele.pay_cashamount);
    mainSumTotal.sumMoneyTransfer += parseFloat(ele.sum_transfer);
    mainSumTotal.sumCreditCard += parseFloat(ele.sum_creditcard);
    mainSumTotal.sumCheque += parseFloat(ele.sum_cheque);
    mainSumTotal.sumCoupon += parseFloat(ele.sum_coupon);
    mainSumTotal.sumQrcode += parseFloat(ele.sum_qrcode);
    mainSumTotal.sumCredit += parseFloat(ele.sum_credit);
    mainSumTotal.totalPayment += parseFloat(ele.total_payment);


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

function processDataRow(ele, body) {
  // Adjust ele.paycashchange if necessary
  ele.paycashchange = ele.paycashchange || 0;

  // Add data row to body
  body.push([
    // Your data row cells here
    { text: `${utils.formateDate(ele.doc_date)}`, style: "tableCell", alignment: "center" },
    { text: utils.formatNumber(ele.total_value), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.round_amount), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.total_amount), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.pay_cashamount), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sum_transfer), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sum_creditcard), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sum_cheque), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sum_coupon), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sum_qrcode), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.sum_credit), style: "tableCell", alignment: "right" },
    { text: utils.formatNumber(ele.total_payment), style: "tableCell", alignment: "right" },

  ]);

}

function addOverallTotalRow(body, totals) {
  body.push([
    { text: "รวม", style: "tableFooter", alignment: "center" },
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


const pdfPreview = async (shopid, fromdate, todate, printby, branchcode, res) => {
  var dataset = await dataresult(shopid, fromdate, todate, printby, branchcode);
  var dataprofile = await globalservice.dataShop(shopid);
  console.log(dataset);
  // console.log(dataprofile);
  if (dataset.success && dataprofile.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, branchcode), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const genDownLoadReceiveByDatePDF = async (fileName, shopid, fromdate, todate, printby, branchcode) => {
  console.log("processing");
  var dataset = await dataresult(shopid, fromdate, todate, printby, branchcode);
  var dataprofile = await globalservice.dataShop(shopid);

  if (dataset.success) {
    try {
      var body = await genBodyPDF(dataset.data);
      var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, printby, branchcode), {});
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



module.exports = { dataresult, genPDF, pdfPreview, genDownLoadReceiveByDatePDF };
