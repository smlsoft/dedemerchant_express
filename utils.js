const Numeral = require("numeral");
const formatNumber = (val, digit = 0) => {
    if (val == 0) {
      return "0.00";
    } else if (val < 0) {
      return Numeral(val).format("(0,0.00)");
    } else {
      return Numeral(val).format("0,0.00");
    }
  };

  const formateDate = (datetime) => {
    let utcDate = new Date(datetime); 
    let date = new Date(utcDate.toLocaleString());


    let day = String(date.getDate()).padStart(2, '0');
    let month = String(date.getMonth() + 1).padStart(2, '0'); // January is 0
    let year = date.getFullYear();

    let formattedDate = day + '/' + month + '/' + year;
    
    return formattedDate;
  };

  const packName = (names) => {
    var result = "";
    if(names != null){
      for (var i = 0; i < names.length; i++) {
        if (names[i].name != "") {
          // if (i > 0 ) {
          //   result += ",";
          // }
          if(names[i].code=='th'){
            result += names[i].name;
          }
        }
      }
    }
    return result;
  };

  module.exports = {formatNumber,formateDate,packName}