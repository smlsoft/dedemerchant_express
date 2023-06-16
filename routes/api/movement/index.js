const express = require("express");
const router = express.Router();
const data = require("./data");
const utils = require("../../../utils");

router.get("/", async (req, res) => {

  if (!utils.isNotEmpty(req.query.shopid)) {
    res.status(500).json({ success: false, msg: "shopid is empty" });
    return;
  }

  try {
    var dataset = await data.dataresult(req.query.shopid, req.query.barcode, req.query.fromdate, req.query.todate);
    console.log(dataset)
    res.status(200).json({ success: true, data: dataset });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }

});

module.exports = router;
