
const provider = require("../../../provider");


    const getProductBarcode = async (token) => {
        console.log(`/product/barcode`);
     
        return provider.instanceApi(token).get(`/product/barcode?limit=100000`).then(res => res.data);
    }
  
    module.exports = { getProductBarcode};