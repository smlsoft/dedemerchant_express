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

  module.exports = {formatNumber}