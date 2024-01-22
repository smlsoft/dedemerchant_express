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

const extractDate = (datetime) => {
  if (datetime) {
    // If datetime is a Date object or not a string, convert it to a string
    const dateString = datetime instanceof Date ? datetime.toISOString() : String(datetime);
    return dateString.split("T")[0];
  }
  return "";
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
const formateDateTime = (datetime) => {
  let date = new Date(datetime);
  // console.log("utcDate",utcDate)
  // let date = new Date(utcDate.toLocaleString());
  // console.log("date",date)
  let day = String(date.getDate()).padStart(2, "0");
  let month = String(date.getMonth() + 1).padStart(2, "0"); // January is 0
  let year = date.getFullYear();

  let formattedDate = day + month + year + date.getHours() + date.getMinutes() + date.getSeconds();

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
  if (data != null && data != undefined && data != "undefined" && data != "") {
    result = true;
  }
  return result;
};

const getNameByTransflag = (transflag) => {
  var result = "";
  switch (transflag) {
    case 12:
      result = "ซื้อสินค้า";
      break;
    case 16:
      result = "ส่งคืนสินค้า";
      break;
    case 44:
      result = "ขายสินค้า";
      break;
    case 48:
      result = "รับคืนสินค้า";
      break;
    case 56:
      result = "เบิกสินค้า";
      break;
    case 58:
      result = "รับคืนจากการเบิก";
      break;
    case 60:
      result = "รับสินค้า";
      break;
    case 66:
      result = "ปรับปรุงสต็อก";
      break;
    case 72:
      result = "โอนสินค้า";
      break;
    default:
      result = "Unknow";
      break;
  }
  return result;
};

const currentTimeStamp = (date) => {
  const unixTimestamp = Math.floor(date / 1000);
  return unixTimestamp.toString();
};

module.exports = { formatNumber, formateDate, packName, isNotEmpty, catchAsync, extractDate, getNameByTransflag, currentTimeStamp,formateDateTime };
