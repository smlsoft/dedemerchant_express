
const provider = require("../../../provider");


    const getReport = async (token,search = "") => {
        console.log(`/transaction/stock-adjustment`);
        return provider.instanceApi(token).get(`/transaction/stock-adjustment?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };