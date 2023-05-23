
const provider = require("../../../provider");


    const getReport = async (token,search = "",fromdate= "",todate="") => {
        console.log(`/transaction/sale-invoice`);
        return provider.instanceApi(token).get(`/transaction/sale-invoice?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };