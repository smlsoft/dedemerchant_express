const utils = require("../../../utils");

const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");
const globalservice = require("../../../globalservice");
const provider = require("../../../provider");
const dotenv = require("dotenv");
const { parse } = require("uuid");
dotenv.config();

const dataresult = async (token, fromdate, todate) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: [] };
  try {
    let db;
    db = client.db(process.env.MONGODB_DB);
    let filters = [];

    filters.push({
      shopid: token,
    });

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
console.log(filters);
    const trans = db.collection("transactionSaleInvoice");

    const result = await trans
      .aggregate([
        {
          $match: {
            $and: filters,
          },
        },
      ])
      .toArray();

    var discount = 0;
    var cash = 0;
    var totalamount = 0;
    var cashieramount = 0;
    var totalpaytransfer = 0;
    var totalpaycredit = 0;
    result.forEach((ele) => {
      if (ele.paymentdetailraw != null && ele.paymentdetailraw != undefined && ele.paymentdetailraw != "undefined" && ele.paymentdetailraw != "") {
        var paymentdetail = JSON.parse(ele.paymentdetailraw);
        cash += paymentdetail.cashamount;
      }

      discount += ele.totaldiscount;
      totalamount += ele.totalamount;
    });

    resultSet.success = true;
    resultSet.data = { shopid: token, discount: parseFloat(discount.toFixed(2)), cash: parseFloat(cash.toFixed(2)), cashieramount: 0, totalpaytransfer: 0, totalpaycredit: 0 };
    const dataset = resultSet;

    return dataset;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

module.exports = { dataresult };
