const axios = require("axios");
const { Client } = require("pg");
const { MongoClient } = require("mongodb");
// import source from '@/store/modules/endpoint'
// import { useAuthen } from '@/stores/authen'

const instanceApi = (authentication) => {
  //console.log("API URL : ", process.env.VUE_APP_API);
  console.log(authentication);
  const http = axios.create({ baseURL: process.env.API_PROVIDER });
  http.defaults.headers.common["Content-Type"] = "application/json";
  if (authentication) {
    http.defaults.headers.common["Authorization"] = "Bearer " + authentication;
  }

  return http;
};

const connectPG = async () => {
  const pg = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB_NAME,
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
  });
  return pg;
};

const connectToMongoDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    var options = {};
   // console.log(process.env.MONGO_TLS);
    if (process.env.MONGO_TLS == "true") {
      options = {
        tls: true,
        tlsCAFile: process.env.MONGO_CA_FILENAME,
      };
    }
   // console.log(options);
    const client = new MongoClient(uri, options);
    await client.connect();

    return client;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};
module.exports = { instanceApi, connectPG, connectToMongoDB };
