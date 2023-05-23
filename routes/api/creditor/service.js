
const provider = require("../../../provider");


    const getReport = async (token,search = "") => {
        console.log(`/debtaccount/creditor`);
        return provider.instanceApi(token).get(`/debtaccount/creditor?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };