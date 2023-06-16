const axios = require('axios');

// import source from '@/store/modules/endpoint'
// import { useAuthen } from '@/stores/authen'

const instanceApi = (authentication) => {
  //console.log("API URL : ", process.env.VUE_APP_API);
  console.log(authentication)
  const http = axios.create({ baseURL: process.env.API_PROVIDER });
  http.defaults.headers.common["Content-Type"] = "application/json";
  if (authentication) {
    http.defaults.headers.common["Authorization"] =
      "Bearer " + authentication;
  }

  return http;
};


module.exports = { instanceApi };
