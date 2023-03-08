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

    var dataset = await data.dataresult(where);
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
