
const provider = require("../../../provider");


    const getDebtorReport = async (token,search = "") => {
        console.log(`/debtaccount/debtor`);
        return provider.instanceApi(token).get(`/debtaccount/debtor?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getDebtorReport};