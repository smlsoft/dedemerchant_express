const express = require("express");
const router = express.Router();
const data = require("./data");
const utils = require("../../../utils");
const globalservice = require("../../../globalservice");

router.get("/", async (req, res) => {
  var result = await globalservice.getUserShop(req.query.token);
  if (!result.success) {
    res.status(401).json({ success: false, msg: "Invalid shop" });
    return;
  }

  try {
    var dataset = await data.dataresult(result.data.shopid, req.query.barcode, req.query.fromdate, req.query.todate);
    res.status(200).json({ success: true, data: dataset });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
});

module.exports = router;
