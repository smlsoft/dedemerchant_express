
const provider = require("./provider");
const dotenv = require("dotenv");
dotenv.config();

const getProfileshop = async (token,) => {
    console.log(`/profileshop`);
    return provider.instanceApi(token).get(`/profileshop`).then(res => res.data);
}

const getReport = async (mode,token,search = "",fromdate= "",todate="") => {
    var from_date = "";
    var to_date = "";
    if(fromdate!=''){
        from_date = "&fromdate="+fromdate;
    }
    if(todate!=''){
        to_date = "&todate="+todate;
    }
    return provider.instanceApi(token).get(`${mode}?limit=100000&q=${search}+${from_date}+${to_date}`).then(res => res.data);
}


const dataShop = async (token) => {
    const client = await provider.connectToMongoDB();
    var resultSet = { success: false, data: null };
    try {
      let db;
      db = client.db(process.env.MONGO_DB_NAME);
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


module.exports = { getProfileshop,getReport,dataShop };