const axios = require("axios");
const { Client } = require("pg");

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

module.exports = { instanceApi, connectPG };
