
const provider = require("../../../provider");


    const getReport = async (token,search = "") => {
        console.log(`/transaction/pay`);
        return provider.instanceApi(token).get(`/transaction/pay?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };