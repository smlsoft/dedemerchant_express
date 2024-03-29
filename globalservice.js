const provider = require("./provider");
const dotenv = require("dotenv");
dotenv.config();
const redis = require("redis");

var tlsEnables = false;
if(process.env.REDIS_CACHE_TLS_ENABLE == "true"){
  tlsEnables = true
}
const redisClient = redis.createClient({
  socket: {
    tls: tlsEnables,
  },
  url: process.env.REDIS_CACHE_URI,
});


const getProfileshop = async (token) => {
  console.log(`/profileshop`);
  return provider
    .instanceApi(token)
    .get(`/profileshop`)
    .then((res) => res.data);
};

const getReport = async (mode, token, search = "", fromdate = "", todate = "") => {
  var from_date = "";
  var to_date = "";
  if (fromdate != "") {
    from_date = "&fromdate=" + fromdate;
  }
  if (todate != "") {
    to_date = "&todate=" + todate;
  }
  return provider
    .instanceApi(token)
    .get(`${mode}?limit=100000&q=${search}+${from_date}+${to_date}`)
    .then((res) => res.data);
};

const dataShop = async (token) => {
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: null };
  try {
    let db;
    db = client.db(process.env.MONGODB_DB);
    const shops = db.collection("shops");
    const data = await shops.find({ guidfixed: token }).toArray();

    if (data.length > 0) {
      resultSet.success = true;
      resultSet.data = data[0];
    } else {
      resultSet.success = false;
      resultSet.data = null;
    }

    // console.log(data);
    return resultSet;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

const dataCompany = async (shopid) => {
 
  const client = await provider.connectToMongoDB();
  var resultSet = { success: false, data: null };
  try {
    let db;
    db = client.db(process.env.MONGODB_DB);
    const collect= db.collection("restaurantSettings");
    const data = await collect.find({ shopid: shopid,code:'company' }).toArray();

    if (data.length > 0) {
      resultSet.success = true;
      resultSet.data = data[0];
    } else {
      resultSet.success = false;
      resultSet.data = null;
    }

    // console.log(data);
    return resultSet;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
};

const getUserShop = async (token) => {

  var results = { success: false, data: null, msg: "" };
  try {
    if (redisClient.isReady) {
      var cacheResults = await redisClient.HGETALL(`auth-${token}`);
     // console.log(cacheResults);
      if (cacheResults.shopid != undefined && cacheResults.shopid != null && cacheResults.shopid != "undefined") {
        isCached = true;
        results.success = true;
        results.data = cacheResults;
      } else {
        results.success = false;
        results.data = null;
        results.msg = "Invalid Shop";
      }
    }else{
      results.msg = "redis not ready"
     
      return results;
    }
  } catch (error) {

    throw new Error(error);
  }

  return results;
};

module.exports = { getProfileshop, getReport, dataShop, getUserShop ,dataCompany,redisClient};
