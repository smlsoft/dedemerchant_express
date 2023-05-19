
const provider = require("../../../provider");


    const getCreditorReport = async (token,search = "") => {
        console.log(`/debtaccount/creditor`);
        return provider.instanceApi(token).get(`/debtaccount/creditor?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getCreditorReport };