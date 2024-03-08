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
  const query = `select pincode,status,shipid from poscenter.pinlist  where pincode = '${pin}'`;

  const resultSet = await client.query({
    query: query,
    format: "JSONEachRow",
  });
  const dataset = await resultSet.json();
  console.log(dataset);
  return dataset;
};

const setActivePos = async (pin, shopid, token, deviceid, actoken, isdev, apikey) => {
  const query = `select pincode,status,shipid,token,deviceid,access_token,isdev,apikey from poscenter.pinlist  where pincode = '${pin}'`;
  var result = { success: false, msg: "" };
  try {
    const resultSet = await client.query({
      query: query,
      format: "JSONEachRow",
    });
    const dataset = await resultSet.json();

    if (dataset.length > 0) {
      const activeQuery = `ALTER TABLE poscenter.pinlist UPDATE status=1,shipid='${shopid}',token='${token}',access_token='${actoken}',deviceid='${deviceid}',isdev='${isdev}',apikey='${apikey}' where pincode = '${pin}'`;

      await client.exec({ query: activeQuery });

      console.log("Data update successful");
      result.msg = "POS active successful"
      result.success = true;
    } else {
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

/// DELETE FROM poscenter.pinlist  WHERE pincode = '${pin}' and shopid='${shopid}
const deletePos = async (pin, shopid) => {
  const query = `select pincode,status,shipid from poscenter.pinlist  where pincode = '${pin}' and shipid='${shopid}'`;
  var result = { success: false, msg: "" };
  try {
    const resultSet = await client.query({
      query: query,
      format: "JSONEachRow",
    });
    const dataset = await resultSet.json();

    if (dataset.length > 0) {
      const activeQuery = `ALTER TABLE poscenter.pinlist DELETE  WHERE pincode = '${pin}' and shipid='${shopid}'`;

      await client.exec({ query: activeQuery });

      console.log("Data delete successful");
      result.msg = "POS delete successful"
      result.success = true;
    } else {
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

/// GET APIKEY FROM poscenter.pinlist  WHERE pincode = '${pin}' and shipid='${shopid}
const getApikey = async (pin, shopid) => {
  const query = `select pincode,status,shipid,apikey from poscenter.pinlist  where pincode = '${pin}' and shipid='${shopid}'`;
  var result = { success: false, msg: "" };
  try {
    const resultSet = await client.query({
      query: query,
      format: "JSONEachRow",
    });
    const dataset = await resultSet.json();

    if (dataset.length > 0) {
      result.msg = "APIKEY Get successful"
      result.success = true;
      result.data = dataset;
    } else {
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


module.exports = { dataresult, setActivePos, deletePos ,getApikey};
