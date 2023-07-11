const provider = require("../../../provider");
const utils = require("../../../utils");

const dataresult = async (shopid, barcode, fromdate, todate) => {

  const pg = await provider.connectPG();
  var where = "";
  
  if (utils.isNotEmpty(barcode)) {
    where += ` and barcode = '${barcode}' `;
  }
  if (utils.isNotEmpty(fromdate) && utils.isNotEmpty(todate)) {
    where += `and docdate between '${fromdate} 00:00:00' and '${todate} 23:59:59' `;
  } else if (utils.isNotEmpty(fromdate)) {
    where += `and docdate >= '${fromdate} 00:00:00' `;
  } else if (utils.isNotEmpty(todate)) {
    where += `and docdate <= '${todate} 23:59:59' `;
  }

  var query = `select stk.docdate, stk.docno,stkd.barcode,stkd.qty,stk.transflag,stkd.calcflag
  from stock_transaction AS stk
  join stock_transaction_detail AS stkd on stk.docno = stkd.docno and  stk.shopid = stkd.shopid 
  where stk.shopid = '${shopid}' ${where} `;
  try {

    await pg.connect();

    const result = await pg.query(query);
    return result.rows;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

module.exports = { dataresult };
