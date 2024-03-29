const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const utils = require("../../../utils");
const fs = require("fs");
const data = require("./data");
const printer = require("../../../pdfprinter");
var bodyParser = require("body-parser");


router.get("/", utils.catchAsync(async (req, res) => {
  try {
    var where = "";

    var dataset = await data.dataresult(req.query.pin);
    res.status(200).json({ success: true, data: dataset, msg: "" });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
}));

router.get("/active", utils.catchAsync(async (req, res) => {
  try {
    var dataset = await data.setActivePos(req.query.pin, req.query.shopid, req.query.token, req.query.deviceid, req.query.actoken, req.query.isdev, req.query.apikey);
    if (dataset.success) {
      res.status(200).json(dataset);
    } else {
      res.status(500).json(dataset);
    }
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
}));

router.get("/delete", utils.catchAsync(async (req, res) => {
  try {
    var dataset = await data.deletePos(req.query.pin, req.query.shopid);
    if (dataset.success) {
      res.status(200).json(dataset);
    } else {
      res.status(500).json(dataset);
    }
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
}));

router.get("/getapikey", utils.catchAsync(async (req, res) => {
  try {
    var dataset = await data.getApikey(req.query.pin, req.query.shopid);
    if (dataset.success) {
      res.status(200).json(dataset);
    } else {
      res.status(500).json(dataset);
    }
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
}));


module.exports = router;
