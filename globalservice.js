
const provider = require("./provider");

const getProfileshop = async (token,) => {
    console.log(`/profileshop`);
    return provider.instanceApi(token).get(`/profileshop`).then(res => res.data);
}

const getReport = async (mode,token,search = "",fromdate= "",todate="") => {
    var from_date = "";
    var to_date = "";
    if(fromdate!=''){
        from_date = "&fromdate="+fromdate;
    }
    if(todate!=''){
        to_date = "&todate="+todate;
    }
    return provider.instanceApi(token).get(`${mode}?limit=100000&q=${search}+${from_date}+${to_date}`).then(res => res.data);
}


module.exports = { getProfileshop,getReport };