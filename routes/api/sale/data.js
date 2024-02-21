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

const dataresultPage = async (token, search, fromdate, todate, page, pageSize) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: [], total: 0 };
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

    const totalCount = await data.countDocuments({ $and: filters });

    const offset = (page - 1) * pageSize;

    const result = await data.aggregate([{ $match: { $and: filters } }, { $sort: { docdatetime: 1 } }, { $skip: offset }, { $limit: pageSize }]).toArray();

    resultSet.success = true;
    resultSet.data = result;
    resultSet.total = totalCount;

    return resultSet;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

const dataresult = async (shopid, fromdate, todate, branchcode, showdetail, showsumbydate, iscancel, inquirytype, ispos, fromcustcode, tocustcode, fromsalecode, tosalecode, printby) => {
  const pg = await provider.connectPG();
  var where = "";

  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += ` and date(st.docdate) between '${fromdate}' and '${todate}' `;
  } else if (utils.isNotEmpty(fromdate)) {
    where += ` and date(st.docdate) >= '${fromdate}' `;
  } else if (utils.isNotEmpty(todate)) {
    where += ` and date(st.docdate) <= '${todate}' `;
  }

  if (utils.isNotEmpty(branchcode)) {
    where += ` and branchcode = '${branchcode}' `;
  }

  if (utils.isNotEmpty(iscancel)) {
    if (iscancel == 0) {
      where += ` and iscancel = false`;

    } else {
      where += ``;
    }

  } else {
    where += ` and iscancel = false`;
  }

  if (utils.isNotEmpty(inquirytype)) {
    where += ` and inquirytype = '${inquirytype}' `;
  }

  if (utils.isNotEmpty(ispos)) {
    if (ispos == 1) {
      where += ` and ispos = true `;
    } else {
      where += ` and ispos = false `;
    }
  }

  if (utils.isNotEmpty(fromcustcode) && utils.isNotEmpty(tocustcode)) {
    where += ` AND creditorcode BETWEEN '${fromcustcode}' AND '${tocustcode}'`;
  } else if (utils.isNotEmpty(fromcustcode)) {
    where += ` AND creditorcode = '${fromcustcode}'`;
  } else if (utils.isNotEmpty(tocustcode)) {
    where += ` AND creditorcode = '${tocustcode}'`;
  }

  if (utils.isNotEmpty(fromsalecode) && utils.isNotEmpty(tosalecode)) {
    where += ` AND salecode BETWEEN '${fromsalecode}' AND '${tosalecode}'`;
  } else if (utils.isNotEmpty(fromsalecode)) {
    where += ` AND salecode = '${fromsalecode}'`;
  } else if (utils.isNotEmpty(tosalecode)) {
    where += ` AND salecode = '${tosalecode}'`;
  }

  var query = `
  SELECT
  ((st.docdate AT TIME ZONE 'UTC' AT TIME ZONE '+7')::date)::text  AS docdate 
  ,TO_CHAR((st.docdate AT TIME ZONE 'UTC' AT TIME ZONE '+7') + interval '7 hours', 'HH24:MI') AS doc_time
  ,st.docno
  ,creditorcode
  ,creditornames
  ,totalvalue
  ,coalesce(detailtotaldiscount,0) as detailtotaldiscount 
  ,totalexceptvat
  ,round(totalbeforevat,2) as totalbeforevat
  ,round(totalvatvalue,2) as totalvatvalue
  ,coalesce(detailtotalamount,0) as detailtotalamount
  ,coalesce(totaldiscount,0) as totaldiscount
  ,coalesce(totalamount,0) as totalamount 
  ,salecode
  ,salename
  ,inquirytype
  ,iscancel 
  ,ispos
  from saleinvoice_transaction st
  where st.shopid = '${shopid}' ${where}
  order by docdate,docno `;

  if (showdetail == 1) {
    query = `
    SELECT
    ((st.docdate AT TIME ZONE 'UTC' AT TIME ZONE '+7')::date)::text  AS docdate
    ,TO_CHAR((st.docdate AT TIME ZONE 'UTC' AT TIME ZONE '+7') + interval '7 hours', 'HH24:MI') AS doc_time
    ,st.docno
    ,creditorcode
    ,creditornames
    ,totalvalue
    ,coalesce(detailtotaldiscount,0) as detailtotaldiscount
    ,totalexceptvat
    ,round(totalbeforevat,2) as totalbeforevat
    ,round(totalvatvalue,2) as totalvatvalue
    ,coalesce(detailtotalamount,0) as detailtotalamount
    ,coalesce(totaldiscount,0) as totaldiscount
    ,coalesce(totalamount,0) as totalamount 
    ,salecode
    ,salename
    ,barcode
    ,itemnames
    ,unitnames
    ,whnames
    ,locationnames
    ,qty,price
    ,discountamount
    ,sumamount
    ,inquirytype
    ,iscancel 
    ,ispos
    from saleinvoice_transaction st left join saleinvoice_transaction_detail std on std.shopid = st.shopid and std.docno = st.docno 
    where st.shopid = '${shopid}' ${where}
    order by st.docdate,docno`;
  }

  console.log(query);

  try {
    await pg.connect();
    const result = await pg.query(query);

    const resultGroup = result.rows.reduce((acc, item) => {
      let entry = acc.find((e) => e.docno === item.docno);
      if (!entry) {
        entry = {
          docdate: item.docdate,
          doc_time: item.doc_time,
          docno: item.docno,
          creditorcode: item.creditorcode,
          creditornames: item.creditornames,
          totalvalue: item.totalvalue,
          detailtotaldiscount: item.detailtotaldiscount,
          totalexceptvat: item.totalexceptvat,
          totalbeforevat: item.totalbeforevat,
          totalvatvalue: item.totalvatvalue,
          detailtotalamount: item.detailtotalamount,
          totaldiscount: item.totaldiscount,
          totalamount: item.totalamount,
          salename: item.salename,
          details: [],
        };
        acc.push(entry);
      }

      entry.details.push({
        barcode: item.barcode,
        itemnames: item.itemnames,
        unitnames: item.unitnames,
        whnames: item.whnames,
        locationnames: item.locationnames,
        qty: item.qty,
        price: item.price,
        discountamount: item.discountamount,
        sumamount: item.sumamount,
      });

      return acc;
    }, []);

    var res = { success: true, data: resultGroup, msg: "success" };
    //console.log(res);
    return res;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

const groupedData = async (data) => {
  return data.reduce((acc, item) => {
    const key = `${item.docno}`;

    if (!acc[key]) {
      acc[key] = {
        docdate: item.docdate,
        doc_time: item.doc_time,
        docno: item.docno,
        cust_name: item.cust_name,
        totalvalue: item.totalvalue,
        detailtotaldiscount: item.detailtotaldiscount,
        totalexceptvat: item.totalexceptvat,
        totalbeforevat: item.totalbeforevat,
        totalvatvalue: item.totalvatvalue,
        detailtotalamount: item.detailtotalamount,
        totaldiscount: item.totaldiscount,
        totalamount: item.totalamount,
        salename: item.salename,
        details: [],
      };
    }
    if (item.barcode !== undefined && item.barcode !== null && item.barcode !== "") {
      acc[key].details.push({
        barcode: item.barcode,
        item_name: item.item_name,
        unit_name: item.unit_name,
        whname: item.whname,
        lcname: item.lcname,
        qty: item.qty,
        price: item.price,
        discountamount: item.discountamount,
        sumamount: item.sumamount,
      });
    }

    return acc;
  }, {});
};

// const dataresult = async (token, search, fromdate, todate) => {
//   const client = await provider.connectToMongoDB();
//   var resultSet = { success: false, data: [] };
//   try {
//     let db;
//     db = client.db(process.env.MONGODB_DB);
//     let filters = [];

//     if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
//       filters.push({
//         docdatetime: {
//           $gte: new Date(fromdate + "T00:00:00Z"),
//         },
//       });
//       filters.push({
//         docdatetime: {
//           $lt: new Date(todate + "T23:59:59Z"),
//         },
//       });
//     }

//     if (utils.isNotEmpty(search)) {
//       filters = [];
//       const pattern = new RegExp(search, "i");
//       filters.push({
//         $or: [
//           {
//             docno: { $regex: pattern },
//           },
//           {
//             custname: {
//               $elemMatch: {
//                 name: { $regex: pattern },
//               },
//             },
//           },
//         ],
//       });
//     }

//     filters.push({
//       shopid: token,
//     });

//     const data = db.collection("transactionSaleInvoice");

//     const result = await data
//       .aggregate([
//         {
//           $match: {
//             $and: filters,
//           },
//         },
//         {
//           $sort: { docdatetime: 1 }, // Sorting in descending order
//         },
//       ])
//       .toArray();
//     resultSet.success = true;
//     resultSet.data = result;
//     const dataset = resultSet;

//     for (let index = 0; index < dataset.data.length; index++) {
//       //   console.log(index + " : " + dataset.data[index].docdatetime);
//     }

//     return dataset;
//   } catch (error) {
//     console.error("Error connecting to MongoDB:", error);
//   } finally {
//     await client.close();
//   }
// };

const genPDF = async (body, dataprofile, fromdate, todate, branchcode, showdetail, showsumbydate, iscancel, inquirytype, ispos, fromcustcode, tocustcode, fromsalecode, tosalecode, printby) => {
  var custcodeText = "";
  var branchText = "";
  var inquirytypeText = "";
  var saleTypeText = "";


  if (utils.isNotEmpty(fromcustcode) && utils.isNotEmpty(tocustcode)) {
    custcodeText = ` , ลูกค้า : ${fromcustcode} ถึง ${tocustcode}`;
  } else if (utils.isNotEmpty(fromcustcode)) {
    custcodeText = ` , ลูกค้า : ${fromcustcode}`;
  } else if (utils.isNotEmpty(tocustcode)) {
    custcodeText = ` , ลูกค้า : ${tocustcode}`;
  }

  if (utils.isNotEmpty(branchcode)) {
    branchText = `สาขา : ${branchcode}`;
  }

  if (utils.isNotEmpty(fromsalecode) && utils.isNotEmpty(tosalecode)) {
    custcodeText = ` , พนักงาน : ${fromsalecode} ถึง ${tosalecode}`;
  } else if (utils.isNotEmpty(fromsalecode)) {
    custcodeText = ` , พนักงาน : ${fromsalecode}`;
  } else if (utils.isNotEmpty(tosalecode)) {
    custcodeText = ` , พนักงาน : ${tosalecode}`;
  }


  if (utils.isNotEmpty(inquirytype)) {
    if (inquirytype == 0) {
      inquirytypeText = ` , ประเภทการขาย : เงินเชื่อ`;
    } else if (inquirytype == 1) {
      inquirytypeText = ` , ประเภทการขาย : เงินสด`;
    } else {
      inquirytypeText = ` , ประเภทการขาย ${inquirytype}`;
    }
  } else {
    inquirytypeText = ` , ประเภทการขาย : ทั้งหมด`;
  }

  if (utils.isNotEmpty(ispos)) {
    if (ispos == 1) {
      saleTypeText = ` , รายการ  : หน้าร้าน`;
    } else if (ispos == 0) {
      saleTypeText = ` , รายการ  : หลังร้าน`;
    }
  } else {
    saleTypeText = ` , รายการ  : ทั้งหมด`;
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
          text: "จากวันที่ : " + utils.formateDate(fromdate) + " ถึงวันที่ : " + utils.formateDate(todate) + custcodeText + branchText + inquirytypeText + saleTypeText,
          style: "subheader",
          alignment: "center",
          /// margin: [left, top, right, bottom]
          margin: [10, 0, 10, 10],

        },
        {
          alignment: "justify",
          columns: [
            {
              text: "หัวข้อ : รายงานการขาย",
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
      tableCellHeader: {
        fontSize: 7,
        bold: true,
      },
      tableCell: {
        fontSize: 7,
      },
      tableFooter: {
        fontSize: 7,
        bold: true,
      },
    },
  };
  if (body.length > 0) {
    docDefinition.content.push({
      style: "tableExample",
      table: {
        headerRows: 2,
        widths: ["9%", "10%", "13%", "8%", "10%", "8%", "8%", "7%", "7%", "7%", "7%", "6%"],
        body: body,
      },
      layout: {
        hLineWidth: function (i, node) {
          if (i === 0) return 1;
          if (i === 1) return 0;
          if (i === 2) return 1;
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

const genBodyPDF = async (dataset, showdetail, showsumbydate) => {
  let body = [];

  body.push(
    [
      { text: "เอกสารวันที่/เวลา", style: "tableHeader", alignment: "left" },
      { text: "เอกสารเลขที่", style: "tableHeader", alignment: "left" },
      { text: "ลูกหนี้", style: "tableHeader", alignment: "left" },
      { text: "มูลค่าสินค้า", style: "tableHeader", alignment: "left" },
      { text: "ส่วนลดก่อนชำระเงิน", style: "tableHeader", alignment: "left" },
      { text: "ยกเว้นภาษี", style: "tableHeader", alignment: "left" },
      { text: "ก่อนภาษี", style: "tableHeader", alignment: "left" },
      { text: "ภาษีมูลค่าเพิ่ม", style: "tableHeader", alignment: "left" },
      { text: "หลังหักส่วนลด", style: "tableHeader", alignment: "left" },
      { text: "ส่วนลดท้ายบิล", style: "tableHeader", alignment: "left" },
      { text: "มูลค่าสุทธิ", style: "tableHeader", alignment: "left" },
      { text: "พนักงานขาย", style: "tableHeader", alignment: "left" },
    ],
    [
      { text: "", style: "tableHeader", alignment: "left" },
      { text: "บาร์โค้ด", style: "tableHeader", alignment: "left" },
      { text: "ชื่อสินค้า", style: "tableHeader", alignment: "left" },
      { text: "", style: "tableHeader", alignment: "left" },
      { text: "หน่วยนับ", style: "tableHeader", alignment: "left" },
      { text: "คลัง", style: "tableHeader", alignment: "left" },
      { text: "พื้นที่เก็บ", style: "tableHeader", alignment: "left" },
      { text: "จำนวน", style: "tableHeader", alignment: "left" },
      { text: "ราคา", style: "tableHeader", alignment: "left" },
      { text: "ส่วนลด", style: "tableHeader", alignment: "left" },
      { text: "รวมมูลค่า", style: "tableHeader", alignment: "left" },
      { text: "", style: "tableHeader", alignment: "left" },

    ]
  );

  const result = [];

  //console.log(dataset)
  await dataset.forEach((entry) => {
    const dateKey = utils.extractDate(entry.docdate);
    let found = result.find((item) => item.docdate === dateKey);

    if (!found) {
      found = {
        docdate: dateKey,
        totalvalue: 0,
        detailtotaldiscount: 0,
        detailtotalamount: 0,
        totaldiscount: 0,
        totalexceptvat: 0,
        totalbeforevat: 0,
        totalvatvalue: 0,
        totalamount: 0,
        details: [],
      };
      result.push(found);
    }
    // console.log("found", found);
    found.totalvalue += parseFloat(entry.totalvalue || 0);
    found.detailtotaldiscount += parseFloat(entry.detailtotaldiscount || 0);
    found.totalexceptvat += parseFloat(entry.totalexceptvat || 0);
    found.totalbeforevat += parseFloat(entry.totalbeforevat || 0);
    found.totalvatvalue += parseFloat(entry.totalvatvalue || 0);
    found.detailtotalamount += parseFloat(entry.detailtotalamount || 0);
    found.totaldiscount += parseFloat(entry.totaldiscount || 0);
    found.totalamount += parseFloat(entry.totalamount || 0);


    found.details.push({
      docdate: entry.docdate,
      doctime: entry.doc_time,
      docno: entry.docno,
      creditorcode: entry.creditorcode,
      creditornames: entry.creditornames,
      totalvalue: entry.totalvalue,
      detailtotaldiscount: entry.detailtotaldiscount,
      totalexceptvat: entry.totalexceptvat,
      totalbeforevat: entry.totalbeforevat,
      totalvatvalue: entry.totalvatvalue,
      detailtotalamount: entry.detailtotalamount,
      totaldiscount: entry.totaldiscount,
      totalamount: entry.totalamount,
      details: entry.details,
      salename: entry.salename,
    });
  });

  result.forEach((data) => {
    data.details.forEach((ele) => {
      body.push([
        { text: `${utils.formateDate(ele.docdate)} ${ele.doctime}`, style: "tableCellHeader", alignment: "left" },
        { text: ele.docno, style: "tableCellHeader" },
        { text: utils.packName(ele.creditornames), style: "tableCellHeader", alignment: "left" },
        { text: utils.formatNumber(ele.totalvalue), style: "tableCellHeader", alignment: "right" },
        { text: utils.formatNumber(ele.detailtotaldiscount), style: "tableCellHeader", alignment: "right" },
        { text: utils.formatNumber(ele.totalexceptvat), style: "tableCellHeader", alignment: "right" },
        { text: utils.formatNumber(ele.totalbeforevat), style: "tableCellHeader", alignment: "right" },
        { text: utils.formatNumber(ele.totalvatvalue), style: "tableCellHeader", alignment: "right" },
        { text: utils.formatNumber(ele.detailtotalamount), style: "tableCellHeader", alignment: "right" },
        { text: utils.formatNumber(ele.totaldiscount), style: "tableCellHeader", alignment: "right" },
        { text: utils.formatNumber(ele.totalamount), style: "tableCellHeader", alignment: "right" },
        { text: ele.salename, style: "tableCellHeader", alignment: "left" },
      ]);

      if (showdetail == 1) {
        ele.details.forEach((detail) => {
          // console.log(detail);
          body.push([
            { text: '', style: "tableCell" },
            { text: detail.barcode, style: "tableCell" },
            { text: utils.packName(detail.itemnames), style: "tableCell", alignment: "left" },
            { text: '', style: "tableCell" },
            { text: utils.packName(detail.unitnames), style: "tableCell", alignment: "left" },
            { text: utils.packName(detail.whnames), style: "tableCell", alignment: "left" },
            { text: utils.packName(detail.locationnames), style: "tableCell", alignment: "left" },
            { text: utils.formatNumber(detail.qty), style: "tableCell", alignment: "right" },
            { text: utils.formatNumber(detail.price), style: "tableCell", alignment: "right" },
            { text: utils.formatNumber(detail.discountamount), style: "tableCell", alignment: "right" },
            { text: utils.formatNumber(detail.sumamount), style: "tableCell", alignment: "right" },
            { text: '', style: "tableCell" },

          ]);
        });
      }
    });

    if (showsumbydate == 1) {
      body.push([
        { text: "", style: "tableFooter", alignment: "center", fillColor: "#E2DDDD" },
        { text: `รวม ${utils.formateDate(data.docdate)}`, style: "tableFooter", alignment: "left", fillColor: "#E2DDDD" },
        { text: "", style: "tableFooter", fillColor: "#E2DDDD" },
        { text: utils.formatNumber(data.totalvalue), style: "tableFooter", alignment: "right", fillColor: "#E2DDDD" },
        { text: utils.formatNumber(data.detailtotaldiscount), style: "tableFooter", alignment: "right", fillColor: "#E2DDDD" },
        { text: utils.formatNumber(data.totalexceptvat), style: "tableFooter", alignment: "right", fillColor: "#E2DDDD" },
        { text: utils.formatNumber(data.totalbeforevat), style: "tableFooter", alignment: "right", fillColor: "#E2DDDD" },
        { text: utils.formatNumber(data.totalvatvalue), style: "tableFooter", alignment: "right", fillColor: "#E2DDDD" },
        { text: utils.formatNumber(data.detailtotalamount), style: "tableFooter", alignment: "right", fillColor: "#E2DDDD" },
        { text: utils.formatNumber(data.totaldiscount), style: "tableFooter", alignment: "right", fillColor: "#E2DDDD" },
        { text: utils.formatNumber(data.totalamount), style: "tableFooter", alignment: "right", fillColor: "#E2DDDD" },
        { text: '', style: "tableFooter", alignment: "right", fillColor: "#E2DDDD" },
      ]);
    }
  });

  var sumTotalvalue = 0;
  var sumDetailtotaldiscount = 0;
  var sumTotalexceptvat = 0;
  var sumTotalbeforevat = 0;
  var sumTotalvatvalue = 0;
  var sumDetailtotalamount = 0;
  var sumTotaldiscount = 0;
  var sumTotalamount = 0;



  dataset.forEach((ele) => {
    sumTotalvalue += parseFloat(ele.totalvalue);
    sumDetailtotaldiscount += parseFloat(ele.detailtotaldiscount);
    sumTotalexceptvat += parseFloat(ele.totalexceptvat);
    sumTotalbeforevat += parseFloat(ele.totalbeforevat);
    sumTotalvatvalue += parseFloat(ele.totalvatvalue);
    sumDetailtotalamount += parseFloat(ele.detailtotalamount);
    sumTotaldiscount += parseFloat(ele.totaldiscount);
    sumTotalamount += parseFloat(ele.totalamount);

  });
  body.push([
    { text: "", style: "tableFooter", alignment: "center", fillColor: "#EBE7E7" },
    { text: "รวม", style: "tableFooter", alignment: "left", fillColor: "#EBE7E7" },
    { text: "", style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
    { text: utils.formatNumber(sumTotalvalue), style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
    { text: utils.formatNumber(sumDetailtotaldiscount), style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
    { text: utils.formatNumber(sumTotalexceptvat), style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
    { text: utils.formatNumber(sumTotalbeforevat), style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
    { text: utils.formatNumber(sumTotalvatvalue), style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
    { text: utils.formatNumber(sumDetailtotalamount), style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
    { text: utils.formatNumber(sumTotaldiscount), style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
    { text: utils.formatNumber(sumTotalamount), style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
    { text: '', style: "tableFooter", alignment: "right", fillColor: "#EBE7E7" },
  ]);

  return body;
};
const pdfPreview = async (shopid, fromdate, todate, branchcode, showdetail, showsumbydate, iscancel, inquirytype, ispos, fromcustcode, tocustcode, fromsalecode, tosalecode, printby, res) => {
  var dataset = await dataresult(shopid, fromdate, todate, branchcode, showdetail, showsumbydate, iscancel, inquirytype, ispos, fromcustcode, tocustcode, fromsalecode, tosalecode, printby);
  var dataprofile = await globalservice.dataShop(shopid);
  if (dataset.success) {
    var body = await genBodyPDF(dataset.data, showdetail, showsumbydate);
    var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, branchcode, showdetail, showsumbydate, iscancel, inquirytype, ispos, fromcustcode, tocustcode, fromsalecode, tosalecode, printby), {});
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } else {
    res.status(500).json({ success: false, data: [], msg: "no shop data" });
  }
};

const genDownLoadSaleInvPDF = async (fileName, shopid, fromdate, todate, branchcode, showdetail, showsumbydate, iscancel, inquirytype, ispos, fromcustcode, tocustcode, fromsalecode, tosalecode, printby) => {
  console.log("processing");
  var dataset = await dataresult(shopid, fromdate, todate, branchcode, showdetail, showsumbydate, iscancel, inquirytype, ispos, fromcustcode, tocustcode, fromsalecode, tosalecode, printby);
  var dataprofile = await globalservice.dataShop(shopid);

  if (dataset.success) {
    try {
      var body = await genBodyPDF(dataset.data, showdetail, showsumbydate);

      var pdfDoc = printer.createPdfKitDocument(await genPDF(body, dataprofile, fromdate, todate, branchcode, showdetail, showsumbydate, iscancel, inquirytype, ispos, fromcustcode, tocustcode, fromsalecode, tosalecode, printby), {});
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

module.exports = { dataresult, genPDF, pdfPreview, pdfDownload, sendEmail, genDownLoadSaleInvPDF, dataresultPage };
