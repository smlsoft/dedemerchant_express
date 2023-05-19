
const provider = require("../../../provider");


    const getReport = async (token,search = "") => {
        console.log(`/transaction/stock-transfer`);
        return provider.instanceApi(token).get(`/transaction/stock-transfer?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };