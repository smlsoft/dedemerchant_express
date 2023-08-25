const Numeral = require("numeral");
const formatNumber = (val, digit = 0) => {
  if (val == 0) {
    return "0.00";
  } else if (val < 0) {
    return Numeral(val).format("-0,0.00");
  } else {
    return Numeral(val).format("0,0.00");
  }
};

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => next(err));
};


const formateDate = (datetime) => {
  let date = new Date(datetime);
  // console.log("utcDate",utcDate)
  // let date = new Date(utcDate.toLocaleString());
  // console.log("date",date)
  let day = String(date.getDate()).padStart(2, "0");
  let month = String(date.getMonth() + 1).padStart(2, "0"); // January is 0
  let year = date.getFullYear();

  let formattedDate = day + "/" + month + "/" + year;

  return formattedDate;
};

const packName = (names) => {
  var result = "";
  if (names != null) {
    for (var i = 0; i < names.length; i++) {
      if (names[i].name != "") {
        // if (i > 0 ) {
        //   result += ",";
        // }
        if (names[i].code == "th") {
          result += names[i].name;
        }
      }
    }
  }
  return result;
};

const isNotEmpty = (data) => {
  var result = false;
  if (data != null && data != undefined && data != 'undefined'  && data != "") {
    result = true;
  }
  return result;
};

module.exports = { formatNumber, formateDate, packName,isNotEmpty, catchAsync };
