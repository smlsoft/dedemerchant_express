
const provider = require("../../../provider");


    const getReport = async (token,search = "") => {
        console.log(`/transaction/paid`);
        return provider.instanceApi(token).get(`/transaction/paid?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };