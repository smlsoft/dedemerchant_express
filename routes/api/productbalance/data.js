const provider = require("../../../provider");
const utils = require("../../../utils");

const dataresult = async (shopid, search, fromdate, todate) => {
  const pg = await provider.connectPG();
  var where = "";

  if (utils.isNotEmpty(search)) {
    where += ` and ( barcode like '%${search}%'  or EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(a.names) AS element
      WHERE element LIKE '%${search}%'
  ) )`;
  }

  var query = `select a.shopid,a.barcode
  ,concat(a.names,' / ',a.unitcode) as barcodename
  ,(select b.unitcode from productbarcode b where b.barcode = a.mainbarcoderef limit 1) as standunit
  ,a.balanceqty,a.averagecost,a.balanceamount
  from productbarcode a
  where a.shopid = '${shopid}' ${where} 
  order by a.barcode  `;
  try {
    await pg.connect();
    console.log(query)
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
