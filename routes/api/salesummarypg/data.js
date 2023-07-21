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
    console.log(data);
    return data;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

module.exports = { dataresult };
