
const provider = require("../../../provider");


    const getReport = async (token,search = "") => {
        console.log(`/transaction/purchase-return`);
        return provider.instanceApi(token).get(`/transaction/purchase-return?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };