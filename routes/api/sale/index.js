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
    var mode = "item";
    if (req.query.mode != undefined && req.query.mode != "") {
      mode = req.query.mode;
    }
    if ( 
      req.query.fromdate != undefined &&
      req.query.fromdate != "" &&
      req.query.todate != undefined &&
      req.query.todate != ""
    ) {
      where += " and docdatetime >= toDateTime('"+req.query.fromdate+" 00:00:00') AND `docdatetime` < toDateTime('"+req.query.todate+" 00:00:00')";
    }else{
      res.status(500).json({ success: false, data: [], msg: "fromdate todate invalid" });
      return;
    }

    if (req.query.doctype != undefined && req.query.doctype != "") {
      

      where += " and doctype in (" + req.query.doctype + ") ";
    }

    if (req.query.custcode != undefined && req.query.custcode != "") {
      var filter = "";
  
      req.query.custcode.trim().split(",").forEach((data,index) => {
        if(index > 0){
          filter += `,'${data.trim()}'`
        }else{
          filter += `'${data.trim()}'`
        }
       
      });

      where += " and custcode in (" + filter + ") ";
    }

    if (req.query.inquirytype != undefined && req.query.inquirytype != "") {
      where += " and inquirytype in (" + req.query.inquirytype + ") ";
    }

    if (req.query.vattype != undefined && req.query.vattype != "") {
      where += " and vattype = '" + req.query.vattype + "' ";
    }

    if (req.query.ispos != undefined && req.query.ispos != "") {
      where += " and ispos = '" + req.query.ispos + "' ";
    }

    if (req.query.itemcode != undefined && req.query.itemcode != "") {
      var filter = "";
      req.query.itemcode.split(",").forEach((data,index) => {
        if(index > 0){
          filter += `,'${data.trim()}'`
        }else{
          filter += `'${data.trim()}'`
        }
       
      });
      where += " and itemcode in (" + filter + ") ";
    }

    if (req.query.whcode != undefined && req.query.whcode != "") {
      var filter = "";
      req.query.whcode.trim().split(",").forEach((data,index) => {
        if(index > 0){
          filter += `,'${data.trim()}'`
        }else{
          filter += `'${data.trim()}'`
        }
       
      });
      where += " and whcode in (" + filter + ") ";
    }

    if (req.query.shelfcode != undefined && req.query.shelfcode != "") {
      var filter = "";
      req.query.shelfcode.trim().split(",").forEach((data,index) => {
        if(index > 0){
          filter += `,'${data.trim()}'`
        }else{
          filter += `'${data.trim()}'`
        }
       
      });
      where += " and shelfcode in (" + filter + ") ";
    }

    if (req.query.salecode != undefined && req.query.salecode != "") {
      var filter = "";
      req.query.salecode.trim().split(",").forEach((data,index) => {
        if(index > 0){
          filter += `,'${data.trim()}'`
        }else{
          filter += `'${data.trim()}'`
        }
       
      });
      where += " and salecode in (" + filter + ") ";
    }

    var dataset = await data.dataresult(where,mode);
    console.log(dataset);
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

router.get("/pdfview", async (req, res) => {
  console.log("pdfview");
  var where = "";
  console.log(req.query.fromdate)
  if (
    req.query.fromdate != undefined &&
    req.query.fromdate != "" &&
    req.query.todate != undefined &&
    req.query.todate != ""
  ) {
    where +=
      " and td.docdatetime between '" +
      req.query.fromdate +
      "' and '" +
      req.query.todate +
      "' ";
  }else{
    res.status(500).json({ success: false, data: [], msg: "fromdate todate invalid" });
    return;
  }

  if (req.query.doctype != undefined && req.query.doctype != "") {
    where += " and td.doctype in (" + req.query.doctype + ") ";
  }

  if (req.query.custcode != undefined && req.query.custcode != "") {
    where += " and t.custcode in (" + req.query.custcode + ") ";
  }

  if (req.query.inquirytype != undefined && req.query.inquirytype != "") {
    where += " and td.inquirytype in (" + req.query.inquirytype + ") ";
  }

  if (req.query.vattype != undefined && req.query.vattype != "") {
    where += " and td.vattype = '" + req.query.vattype + "' ";
  }

  if (req.query.ispos != undefined && req.query.ispos != "") {
    where += " and td.ispos = '" + req.query.ispos + "' ";
  }

  if (req.query.itemcode != undefined && req.query.itemcode != "") {
    where += " and td.itemcode in (" + req.query.itemcode + ") ";
  }

  if (req.query.whcode != undefined && req.query.whcode != "") {
    where += " and td.whcode in (" + req.query.whcode + ") ";
  }

  if (req.query.shelfcode != undefined && req.query.shelfcode != "") {
    where += " and td.shelfcode in (" + req.query.shelfcode + ") ";
  }

  if (req.query.salecode != undefined && req.query.salecode != "") {
    where += " and t.salecode in (" + req.query.salecode + ") ";
  }

  data.pdfPreview(res,where);
});

router.get("/pdfdownload", async (req, res) => {
  console.log("pdfdownload");
  var where = "";
  console.log(req.query.fromdate)
  if (
    req.query.fromdate != undefined &&
    req.query.fromdate != "" &&
    req.query.todate != undefined &&
    req.query.todate != ""
  ) {
    where +=
      " and td.docdatetime between '" +
      req.query.fromdate +
      "' and '" +
      req.query.todate +
      "' ";
  }else{
    res.status(500).json({ success: false, data: [], msg: "fromdate todate invalid" });
    return;
  }

  if (req.query.doctype != undefined && req.query.doctype != "") {
    where += " and td.doctype in (" + req.query.doctype + ") ";
  }

  if (req.query.custcode != undefined && req.query.custcode != "") {
    where += " and t.custcode in (" + req.query.custcode + ") ";
  }

  if (req.query.inquirytype != undefined && req.query.inquirytype != "") {
    where += " and td.inquirytype in (" + req.query.inquirytype + ") ";
  }

  if (req.query.vattype != undefined && req.query.vattype != "") {
    where += " and td.vattype = '" + req.query.vattype + "' ";
  }

  if (req.query.ispos != undefined && req.query.ispos != "") {
    where += " and td.ispos = '" + req.query.ispos + "' ";
  }

  if (req.query.itemcode != undefined && req.query.itemcode != "") {
    where += " and td.itemcode in (" + req.query.itemcode + ") ";
  }

  if (req.query.whcode != undefined && req.query.whcode != "") {
    where += " and td.whcode in (" + req.query.whcode + ") ";
  }

  if (req.query.shelfcode != undefined && req.query.shelfcode != "") {
    where += " and td.shelfcode in (" + req.query.shelfcode + ") ";
  }

  if (req.query.salecode != undefined && req.query.salecode != "") {
    where += " and t.salecode in (" + req.query.salecode + ") ";
  }
  data.pdfDownload(res,where);
});

module.exports = router;
