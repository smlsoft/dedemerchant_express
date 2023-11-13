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

  var query = `SELECT shopid, sum(totaldiscount) as discount,sum(totalamount) as cash,sum(totalpaycash) as cashierAmount,sum(totalpaytransfer) as totalpaytransfer,sum(totalpaycredit) as totalpaycredit FROM public.saleinvoice_transaction where shopid='${shopid}' ${where} group by shopid`;
  try {
    await pg.connect();

    const result = await pg.query(query);
    // console.log(result);
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

  var query = `SELECT docdate::date,sum(totalamount) as totalamount FROM public.saleinvoice_transaction where shopid='${shopid}' ${where}  group by shopid,docdate order by docdate asc
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
    const groupedData = {Mon: groupByDay.Monday ?? 0, Tue: groupByDay.Tuesday ?? 0, Wed:  groupByDay.Wednesday ?? 0, Thu: groupByDay.Thursday ?? 0, Fri: groupByDay.Friday ?? 0, Sat: groupByDay.Saturday ?? 0, Sun: groupByDay.Sunday ?? 0}
    
    console.log(groupedData)
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

  var query = `select barcode,itemnames,unitcode,sum(qty) as total_qty from public.saleinvoice_transaction_detail where docno in (SELECT docno FROM public.saleinvoice_transaction where 
    shopid='${shopid}' ${where}
    order by docdate asc) and shopid='${shopid}' group by barcode,itemnames,unitcode order by total_qty desc`;
  try {
    await pg.connect();

    const result = await pg.query(query);
    console.log(result);
    var dataresult = [];
    result.rows.forEach((ele) => {
      dataresult.push({
        barcode: ele.barcode,
        itemnames: ele.itemnames,
        unitcode: ele.unitcode,
        total_qty: ele.total_qty,
      });
    });
    console.log(dataresult);
 
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

module.exports = { dataresult, dataWeeklySale ,dataProductSale};
