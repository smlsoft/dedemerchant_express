const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const utils = require("../../../utils");
const fs = require("fs");
const data = require("./data");
const printer = require("../../../pdfprinter");
var bodyParser = require("body-parser");

router.get("/", async (req, res) => {
  try {
    var where = "";
    var shopid = req.query.shopid;
    if (req.query.keyword != undefined && req.query.keyword != "") {
      where += await _whereLike(req.query.keyword);
    }
    if (req.query.producttype != undefined && req.query.producttype != "") {
      where +=` and producttype in (${req.query.producttype}) `
    }
    if (req.query.taxtype != undefined && req.query.taxtype != "") {
      where +=` and taxtype in (${req.query.taxtype}) `
    }
     
 
     var dataset = await data.dataresult(where,shopid);
    res.status(200).json({ success: true, data: dataset, msg: "" });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
});

router.post("/", (req, res) => {
  const newProduct = {
    code: uuid.v4(),
    names: req.body.names,
  };
  res.json(newProduct);
});

// router.get("/pdfview", async (req, res) => {
//   console.log("pdfview");
//   data.pdfPreview(res);
// });

// router.get("/pdfdownload", async (req, res) => {
//   console.log("pdfdownload");
//   data.pdfDownload(res);
// });

const _whereLike = async (strKeyWord) => {
  var __where = "";
  if (strKeyWord.trim().length > 0) {
    var __fieldList = ["p.code", "itemname", "unitcost", "unitstandard"];
    var __keyword = strKeyWord.trim().split(" ");
    __fieldList.forEach((__fieldList1) => {
      if (__keyword.length > 0) {
        if (__where.length > 0) {
          __where += " OR ";
        } else {
          __where += " and ";
        }
        __where += "(";
        for (var __loop = 0; __loop < __keyword.length; __loop++) {
          if (__loop > 0) {
            __where += " AND ";
          }
          __where += `UPPER(${__fieldList1}) LIKE '%${__keyword[
            __loop
          ].toUpperCase()}%' `;
        }
        __where += ")";
      }
    });
  }

  return __where;
};

module.exports = router;
