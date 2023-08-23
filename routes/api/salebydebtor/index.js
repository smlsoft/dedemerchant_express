const express = require("express");
const router = express.Router();
const data = require("./data");
const utils = require("../../../utils");
const globalservice = require("../../../globalservice");


router.get(
  "/",
  utils.catchAsync(async (req, res) => {
    var result = await globalservice.getUserShop(req.query.token);
    console.log(result);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }

    try {
      var dataset = await data.dataresult(result.data.shopid, req.query.search, req.query.fromdate, req.query.todate);
      res.status(200).json({ success: true, data: dataset });
    } catch (err) {
      res.status(500).json({ success: false, data: [], msg: err.message });
    }
  })
);

router.get(
  "/pdfview",
  utils.catchAsync(async (req, res) => {
    var result = await globalservice.getUserShop(req.query.token);
    console.log(result);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }

    data.pdfPreview(result.data.shopid,req.query.search,req.query.fromdate,req.query.todate,res);
  })
);

module.exports = router;