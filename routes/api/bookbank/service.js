
const provider = require("../../../provider");


    const getBookbankReport = async (token,search = "") => {
        console.log(`/payment/bookbank`);
        return provider.instanceApi(token).get(`/payment/bookbank?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getBookbankReport };