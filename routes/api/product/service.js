
const provider = require("../../../provider");


    const getProductBarcode = async (token,search = "") => {
        console.log(`/product/barcode`);
        return provider.instanceApi(token).get(`/product/barcode?limit=100000&q=${search}`).then(res => res.data);
    }
  
    module.exports = { getProductBarcode};