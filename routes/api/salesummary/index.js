const express = require("express");
const router = express.Router();
const utils = require("../../../utils");
const data = require("./data");

router.get("/", utils.catchAsync(async (req, res) => {
  try {
    var where = "";

    var dataset = await data.dataresult(req.query.from,req.query.todate,req.query.token);
    res.status(200).json({ success: true, data: dataset, msg: "" });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
}));



module.exports = router;
