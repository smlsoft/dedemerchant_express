
const provider = require("../../../provider");


    const getReport = async (token,search = "") => {
        console.log(`/transaction/stock-receive-product`);
        return provider.instanceApi(token).get(`/transaction/stock-receive-product?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getReport };