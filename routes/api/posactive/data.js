const utils = require("../../../utils");
const { createClient } = require("@clickhouse/client");
const printer = require("../../../pdfprinter");
var nodemailer = require("nodemailer");

const dotenv = require("dotenv");
dotenv.config();
const client = new createClient({
  host: process.env.CH_SERVER_ADDRESS,
  username: process.env.CH_USERNAME,
  password: process.env.CH_PASSWORD,
  database: process.env.CH_DATABASE_NAME,
});

const dataresult = async (pin) => {
  const query = `select pinnumber,isactive,shopid from dede001.posterminal  where pinnumber = '${pin}'`;

  const resultSet = await client.query({
    query: query,
    format: "JSONEachRow",
  });
  const dataset = await resultSet.json();
  console.log(dataset);
  return dataset;
};

const setActivePos = async (pin, shopid,token) => {
  const query = `select pinnumber,isactive,shopid,token from dede001.posterminal  where pinnumber = '${pin}'`;
  var result = { success: false, msg: "" };
  try {
    const resultSet = await client.query({
      query: query,
      format: "JSONEachRow",
    });
    const dataset = await resultSet.json();

    if (dataset.length > 0) {
      const activeQuery = `ALTER TABLE dede001.posterminal UPDATE isactive=1,shopid='${shopid}',token='${token}' where pinnumber = '${pin}'`;

      await client.exec({ query: activeQuery});

      console.log("Data update successful");
      result.msg = "POS active successful"
      result.success = true;
    }else{
      result.msg = "Pin Number not found"
      result.false = true;
    }
  } catch (error) {
    console.error(error);
    result.success = false;
    result.msg = error.message;
  }
  await client.close();
  return result;
};

module.exports = { dataresult, setActivePos };
