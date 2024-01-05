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

  var queryBalance = `select sum(qty*calcflag) as balanceqty,barcode
  from stock_transaction AS stk
  join stock_transaction_detail AS stkd on stk.docno = stkd.docno and  stk.shopid = stkd.shopid 
  where stk.shopid ='${shopid}' and docdate < '${fromdate} 00:00:00' and barcode = '${barcode}'  group by barcode`;

  var query = `select stk.docdate, stk.docno,stkd.barcode,stkd.qty,stk.transflag,stkd.calcflag
  from stock_transaction AS stk
  join stock_transaction_detail AS stkd on stk.docno = stkd.docno and  stk.shopid = stkd.shopid 
  where stk.shopid = '${shopid}' ${where} `;
  try {

    await pg.connect();

    const resultBalance = await pg.query(queryBalance);
    const result = await pg.query(query);
    var balanceqty = 0;
    if(resultBalance.rows.length > 0) {
      balanceqty = resultBalance.rows[0].balanceqty;
    }
    const resultData = {
      balance: parseFloat(balanceqty),
      details: result.rows,
    };

    console.log(resultData);
    
    return resultData;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

module.exports = { dataresult };
