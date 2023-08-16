const axios = require("axios");
const { Client } = require("pg");
const { MongoClient } = require("mongodb");
// import source from '@/store/modules/endpoint'
// import { useAuthen } from '@/stores/authen'
const fs = require("fs");
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

//   pgConnectionOptions = {
//       host: process.env.POSTGRES_HOST,
//       port: process.env.POSTGRES_PORT,
//       database: process.env.POSTGRES_DB_NAME,
//       user: process.env.POSTGRES_USERNAME,
//       password: process.env.POSTGRES_PASSWORD
//   }

  let sslConnectionOption = ``;
if (process.env.POSTGRES_SSL_MODE) {
//   // pgConnectionOptions.ssl = {
//   //   rejectUnauthorized: false,
//   //   ca: process.env.POSTGRES_TLS_CA_FILE,
//   // };
  //  pgConnectionOptions.ssl = {
  //   sslmode: process.env.POSTGRES_SSL_MODE
  //  }
  sslConnectionOption = `?sslmode=${process.env.POSTGRES_SSL_MODE}`
}

  const pgConnectionOptions = {
    connectionString: `postgresql://${process.env.POSTGRES_USERNAME}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB_NAME}${sslConnectionOption}`,
    // ssl: {
    //   rejectUnauthorized: false,
    //   // ca: fs.readFileSync('/Users/sutee/DEV/CA/db-postgresql-sgp1-pos-do-user-11230406-0-ca-certificate.crt').toString(),
    // },
  }
  const pg = new Client(pgConnectionOptions);
  return pg;
};

const connectToMongoDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    var options = {};
   // console.log(process.env.MONGODB_SSL);
    if (process.env.MONGODB_SSL == "true") {
      options = {
        tls: true,
        tlsCAFile: process.env.MONGODB_TLS_CA_FILE,
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
