
const provider = require("../../../provider");


    const getReport = async (token,search = "") => {
        console.log(`/transaction/stock-return-product`);
        return provider.instanceApi(token).get(`/transaction/stock-return-product?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };