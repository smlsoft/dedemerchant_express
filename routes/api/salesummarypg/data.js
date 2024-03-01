const provider = require("../../../provider");
const utils = require("../../../utils");

const dataresult = async (shopid, fromdate, todate) => {
  const pg = await provider.connectPG();
  var where = "";

  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += `and docdate between '${fromdate} 00:00:00' and '${todate} 23:59:59' `;
  } else if (utils.isNotEmpty(fromdate)) {
    where += `and docdate >= '${fromdate} 00:00:00' `;
  } else if (utils.isNotEmpty(todate)) {
    where += `and docdate <= '${todate} 23:59:59' `;
  }

  var query = `SELECT shopid, sum(totaldiscount) as discount,sum(totalamount) as cash,sum(totalpaycash) as cashierAmount,sum(totalpaytransfer) as totalpaytransfer,sum(totalpaycredit) as totalpaycredit FROM public.saleinvoice_transaction where shopid='${shopid}' ${where} and iscancel=true group by shopid`;
  try {
    await pg.connect();
    const result = await pg.query(query);
    var data = [];
    result.rows.forEach((ele) => {
      data.push({
        shopid: ele.shopid,
        discount: parseFloat(parseFloat(ele.discount).toFixed(2)),
        cash: parseFloat(parseFloat(ele.cash).toFixed(2)),
        cashieramount: parseFloat(parseFloat(ele.cashieramount).toFixed(2)),
        totalpaytransfer: parseFloat(parseFloat(ele.totalpaytransfer).toFixed(2)),
        totalpaycredit: parseFloat(parseFloat(ele.totalpaycredit).toFixed(2)),
      });
    });
    // console.log(data);
    return data;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

const dataWeeklySale = async (shopid, fromdate, todate) => {
  const pg = await provider.connectPG();
  var where = "";

  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += `and docdate between '${fromdate} 00:00:00' and '${todate} 23:59:59' `;
  } else if (utils.isNotEmpty(fromdate)) {
    where += `and docdate >= '${fromdate} 00:00:00' `;
  } else if (utils.isNotEmpty(todate)) {
    where += `and docdate <= '${todate} 23:59:59' `;
  }

  var query = `SELECT docdate::date,sum(totalamount) as totalamount FROM public.saleinvoice_transaction where shopid='${shopid}' ${where} and iscancel=false group by shopid,docdate order by docdate asc
  `;
  try {
    await pg.connect();

    const result = await pg.query(query);
    // console.log(result);
    // var dataresult = [];
    // result.rows.forEach((ele) => {
    //   dataresult.push({
    //     docdate: ele.docdate,
    //     totalamount: parseFloat(parseFloat(ele.sumtotal).toFixed(2)),
    //   });
    // });
    console.log(result.rows);

    const groupByDay = await groupByDayAndSum(result.rows);
    const groupedData = {
      Mon: groupByDay.Monday != null ? parseFloat(parseFloat(groupByDay.Monday).toFixed(2)) : 0,
      Tue: groupByDay.Tuesday != null ? parseFloat(parseFloat(groupByDay.Tuesday).toFixed(2)) : 0, 
      Wed: groupByDay.Wednesday != null ? parseFloat(parseFloat(groupByDay.Wednesday).toFixed(2)) : 0, 
      Thu: groupByDay.Thursday != null ? parseFloat(parseFloat(groupByDay.Thursday).toFixed(2)) : 0,
      Fri: groupByDay.Friday != null ? parseFloat(parseFloat(groupByDay.Friday).toFixed(2)) : 0, 
      Sat: groupByDay.Saturday != null ? parseFloat(parseFloat(groupByDay.Saturday).toFixed(2)) : 0, 
      Sun: groupByDay.Sunday != null ? parseFloat(parseFloat(groupByDay.Sunday).toFixed(2)) : 0,
    };

    console.log(groupedData);
    return groupedData;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

const dataProductSale = async (shopid, fromdate, todate) => {
  const pg = await provider.connectPG();
  var where = "";

  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += `and docdate between '${fromdate} 00:00:00' and '${todate} 23:59:59' `;
  } else if (utils.isNotEmpty(fromdate)) {
    where += `and docdate >= '${fromdate} 00:00:00' `;
  } else if (utils.isNotEmpty(todate)) {
    where += `and docdate <= '${todate} 23:59:59' `;
  }

  // var query = `select barcode,itemnames,unitcode,sum(qty) as total_qty,price from public.saleinvoice_transaction_detail where docno in (SELECT docno FROM public.saleinvoice_transaction where
  //   shopid='${shopid}' ${where}
  //   order by docdate asc) and shopid='${shopid}' group by barcode,itemnames,unitcode,price order by total_qty desc`;

  var query = `select st.barcode,st.itemnames,st.unitcode,sum(qty) as qty,sum(st.sumamount) as sumamount,price,mainbarcoderef as owner from public.saleinvoice_transaction_detail st left join public.productbarcode pb on pb.barcode = st.barcode and pb.shopid = st.shopid where st.docno in (SELECT docno FROM public.saleinvoice_transaction where 
      st.shopid='${shopid}' ${where}
      order by docdate asc) and st.shopid='${shopid}' group by st.barcode,st.itemnames,st.unitcode,price,mainbarcoderef order by total_qty desc`;
  try {
    await pg.connect();

    const result = await pg.query(query);
    console.log(result);
    var dataresult = [];
    var xx = 0;
    result.rows.forEach((ele) => {
      var owxx = "";
      if (xx > 5) {
        owxx = "jead";
      }
      dataresult.push({
        shopid: shopid,
        names: ele.itemnames,
        unitcode: ele.unitcode,
        owner: owxx,
        qty: parseFloat(parseFloat(ele.total_qty).toFixed(2)),
        price: parseFloat(parseFloat(ele.price).toFixed(2)),
        sumamount: parseFloat(parseFloat(ele.sumamount).toFixed(2)),
      });

      xx++;
    });

    return dataresult;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

const dataSaleByItem = async (shopid, search, page) => {
  const pg = await provider.connectPG();
  var where = "";
  var limit = 30;

  if (utils.isNotEmpty(search)) {
    var searchTerms = search.split(" ");

    if (searchTerms.length > 0) {
      searchTerms.forEach((term) => {
        term = term.trim();
        if (term) {
          where += ` AND (st.barcode LIKE '%${term}%' OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(st.itemnames) AS element
            WHERE element LIKE '%${term}%'
          )) `;
        }
      });
    } else {
      where += ` and (st.barcode like '%${search}%' or EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(st.itemnames) AS element
      WHERE element LIKE '%${search}%'
  )) `;
    }
  }

  var query = `select sum(qty) as sale_qty,st.barcode,st.itemnames,st.unitcode,sum(st.sumamount) as sumamount,price from saleinvoice_transaction_detail st left join productbarcode pb on pb.barcode = st.barcode and pb.shopid = st.shopid left join saleinvoice_transaction s on s.shopid = st.shopid and s.docno = st.docno where st.shopid='${shopid}' ${where} group by st.barcode,st.itemnames,st.unitcode,price order by sale_qty desc offset ${
    limit * parseFloat(page)
  } limit ${limit}`;
  try {
    await pg.connect();

    const result = await pg.query(query);
    console.log(result);
    var dataresult = [];
    result.rows.forEach((ele) => {
      dataresult.push({
        shopid: shopid,
        barcode: ele.barcode,
        names: ele.itemnames,
        unitcode: ele.unitcode,
        qty: parseFloat(parseFloat(ele.sale_qty).toFixed(2)),
        price: parseFloat(parseFloat(ele.price).toFixed(2)),
        sumamount: parseFloat(parseFloat(ele.sumamount).toFixed(2)),
      });
    });
    // console.log(dataresult);

    return dataresult;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

const getDayName = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

// Function to group by day and sum totalamount
const groupByDayAndSum = (data) => {
  const result = data.reduce((acc, { docdate, totalamount }) => {
    const dayName = getDayName(docdate);
    if (!acc[dayName]) {
      acc[dayName] = 0;
    }
    acc[dayName] += parseFloat(totalamount);
    return acc;
  }, {});

  return result;
};

module.exports = { dataresult, dataWeeklySale, dataProductSale, dataSaleByItem };
