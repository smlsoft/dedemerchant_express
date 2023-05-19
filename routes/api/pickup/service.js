
const provider = require("../../../provider");


    const getReport = async (token,search = "") => {
        console.log(`/transaction/stock-prickup-product`);
        return provider.instanceApi(token).get(`/transaction/stock-prickup-product?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };