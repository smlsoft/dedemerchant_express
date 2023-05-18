const axios = require('axios');

// import source from '@/store/modules/endpoint'
// import { useAuthen } from '@/stores/authen'

const instanceApi = (authentication) => {
  //console.log("API URL : ", process.env.VUE_APP_API);
  console.log(authentication)
  const http = axios.create({ baseURL: 'https://api.dev.dedepos.com' });
  http.defaults.headers.common["Content-Type"] = "application/json";
  if (authentication) {
    http.defaults.headers.common["Authorization"] =
      "Bearer " + authentication;
  }
  
  return http;
};
const instanceApireport = () => {
  //console.log("API URL : ", process.env.VUE_APP_API);

  const http = axios.create({ baseURL: process.env.VUE_APP_REPORT_API_URL });
  //console.log(process.env);
  http.defaults.headers.common["Content-Type"] = "application/json";
  //   if (authentication) {
  //     http.defaults.headers.common["Authorization"] =
  //       "Bearer " + localStorage._token;
  //   }
  return http;
};

module.exports = { instanceApi };
