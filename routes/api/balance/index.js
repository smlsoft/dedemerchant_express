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
    var dataset = await data.dataresult();
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
  data.pdfPreview(res);
});

router.get("/pdfdownload", async (req, res) => {
  console.log("pdfdownload");
  data.pdfDownload(res);
});



module.exports = router;
