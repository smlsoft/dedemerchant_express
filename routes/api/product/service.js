
const provider = require("../../../provider");

const getProfileshop = async (token,) => {
    console.log(`/profileshop`);
    return provider.instanceApi(token).get(`/profileshop`).then(res => res.data);
}

const getProductBarcode = async (token, search = "") => {
    console.log(`/product/barcode`);
    return provider.instanceApi(token).get(`/product/barcode?limit=200&q=${search}`).then(res => res.data);
}

module.exports = { getProductBarcode, getProfileshop };