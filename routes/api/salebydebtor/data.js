const provider = require("../../../provider");
const utils = require("../../../utils");
const globalservice = require("../../../globalservice");
const printer = require("../../../pdfprinter");

const dataresult = async (shopid, search, fromdate, todate) => {
  const pg = await provider.connectPG();
  var where = "";
  var res = {success:false,data:[],msg:""};
  if (utils.isNotEmpty(search)) {
    where += `  and  (creditorcode like '%${search}%' or EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(creditornames) AS element
      WHERE element LIKE '%${search}%'
  ))`;
  }
  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += `and docdate between '${fromdate} 00:00:00' and '${todate} 23:59:59' `;
  } else if (utils.isNotEmpty(fromdate)) {
    where += `and docdate >= '${fromdate} 00:00:00' `;
  } else if (utils.isNotEmpty(todate)) {
    where += `and docdate <= '${todate} 23:59:59' `;
  }

  var query = `select sum(totalvalue) as totalvalue,sum(totalvatvalue) as totalvatvalue,sum(totaldiscount) as totaldiscount,sum(totalexceptvat) as totalexceptvat,sum(totalamount) as totalamount,sum(totalbeforevat) as totalbeforevat,creditorcode,creditornames  from saleinvoice_transaction where shopid='${shopid}' ${where} and creditorcode !='' group by creditorcode,creditornames`;
  try {
    await pg.connect();

    const result = await pg.query(query);
    res.success = true;
    res.data = result.rows;
    return res;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

const genPDF = async (body, dataprofile) => {
  var docDefinition = {
    content: [
      {
        text: "รายงานขายตามลูกหนี้",
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
        headerRows: 1,
        widths: ["20%", "20%", "10%", "10%", "10%", "10%", "10%", "10%"],
        body: body,
      },
      layout: "lightHorizontalLines",
    });
  }
  return docDefinition;
};

const genBodyPDF = async (dataset) => {
  let body = [];

  body.push([
    { text: "รหัส", style: "tableCell", alignment: "left" },
    { text: "ชื่อ", style: "tableCell", alignment: "left" },
    { text: "มูลค่าสินค้า", style: "tableCell", alignment: "left" },
    { text: "มูลค่าส่วนลด", style: "tableCell", alignment: "left" },
    { text: "หลังหักส่วนลด", style: "tableCell", alignment: "left" },
    { text: "ยกเว้นภาษี", style: "tableCell", alignment: "left" },
    { text: "ภาษีมูลค่าเพิ่ม", style: "tableCell", alignment: "left" },
    { text: "มูลค่าสุทธิ", style: "tableCell", alignment: "left" },
  ]),
    dataset.forEach((ele) => {
      body.push([
        { text: ele.creditorcode, style: "tableCell", },
        { text: utils.packName(ele.creditornames), style: "tableCell", alignment: "left",  },
        { text: utils.formatNumber(ele.totalvalue), style: "tableCell", alignment: "right",  },
        { text: utils.formatNumber(ele.totaldiscount), style: "tableCell", alignment: "right",  },
        { text: utils.formatNumber(ele.totalbeforevat), style: "tableCell", alignment: "right",  },
        { text: utils.formatNumber(ele.totalexceptvat), style: "tableCell", alignment: "right",  },
        { text: utils.formatNumber(ele.totalvatvalue), style: "tableCell", alignment: "right",  },
        { text: utils.formatNumber(ele.totalamount), style: "tableCell", alignment: "right",  },
      ]);

    });
  return body;
};

const pdfPreview = async (token, search, fromdate, todate, res) => {
  var dataset = await dataresult(token, search, fromdate, todate);
  console.log(dataset);
  var dataprofile = await globalservice.dataShop(token);
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "" });
  }
};

module.exports = { dataresult, pdfPreview };
