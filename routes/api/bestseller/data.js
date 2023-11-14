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

  var query = `select sum(qty) as sale_qty,st.barcode,pb.names,pb.unitcode,sum(st.sumamount) as sumamount,st.price from saleinvoice_transaction_detail st left join productbarcode pb on pb.barcode = st.barcode and pb.shopid = st.shopid left join saleinvoice_transaction s on s.shopid = st.shopid and s.docno = st.docno where st.shopid='${shopid}' ${where} group by st.barcode,pb.names,pb.unitcode,st.price order by sale_qty desc limit 10`;
  try {
    await pg.connect();

    const result = await pg.query(query);
    // console.log(result);
    var data = [];
    result.rows.forEach((ele) => {
      var names = [{ code: "en", name: ele.barcode },{ code: "th", name: ele.barcode }];
      if(ele.names!=null) {
        names = ele.names;
      }
      data.push({
        shopid: ele.shopid,
        unitcode: ele.unitcode,
        qty: parseFloat(parseFloat(ele.sale_qty).toFixed(2)),
        price: parseFloat(parseFloat(ele.price).toFixed(2)),
        sumamount: parseFloat(parseFloat(ele.sumamount).toFixed(2)),
        barcode: ele.barcode,
        names: names,
      });
    });
    //console.log(data);
    return data;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

module.exports = { dataresult };
