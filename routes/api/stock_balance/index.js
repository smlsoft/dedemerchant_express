const express = require("express");
const router = express.Router();
const data = require("./data");
const globalservice = require("../../../globalservice");
const Queue = require("bull");
const logger = require("../../../logger");
const utils = require("../../../utils");
const fs = require("fs");
const os = require("os");
const path = require("path");
const queueGenStockBalanceReport = new Queue("dedemerchantStockBalanceInvReport", process.env.REDIS_CACHE_URI + "?tls=" + process.env.REDIS_CACHE_TLS_ENABLE);

queueGenStockBalanceReport.process(async (payload) => {
  logger.info("on process");

  data.genDownLoadStockBalancePDF(
    payload.data.fileName,
    payload.data.shopid,
    payload.data.fromdate,
    payload.data.todate,
    payload.data.printby,
    payload.data.showcost,
    payload.data.frombarcode,
    payload.data.tobarcode,
  );
});

queueGenStockBalanceReport.on("completed", (job, result) => {
  logger.info(`Job StockBalance completed with result ${result}`);
});

queueGenStockBalanceReport.on("failed", (job, err) => {
  logger.error(`Job StockBalance failed with error `, err.message);
});

router.get("/genPDFStockBalance", async (req, res) => {
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }

    let fileName = `stockbalance-${result.data.name}-${utils.formateDateTime(Date.now())}.pdf`;

    let payload = {
      fileName: fileName,
      shopid: result.data.shopid,
      fromdate: req.query.fromdate,
      todate: req.query.todate,
      printby: req.query.printby,
      showcost: req.query.showcost,
      frombarcode: req.query.frombarcode,
      tobarcode: req.query.tobarcode,
    }

    const protocol = "https";
    const host = req.get("host"); // Includes hostname and port
    const originalUrl = req.originalUrl;
    const parts = originalUrl.split("/");
    const desiredPath = `/${parts[1]}/${parts[2]}/`;

    queueGenStockBalanceReport
      .add(payload)
      .then((job) => {
        console.log(`Job added with ID: ${job.id}`);
        res.status(200).json({
          success: true,
          message: "PDF generation in progress",
          data: { fileName: fileName, jobId: job.id, downloadLink: `${protocol}://${host}${desiredPath}download-stockbalance/${job.id}/${fileName}` },
        });
      })
      .catch((err) => {
        console.error("Error adding job to queue:", err);
        res.status(500).json({ success: false, msg: err.message });
      });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
});

router.get("/check-stockbalance/:jobId/:filename", async (req, res) => {
  const jobId = req.params.jobId;
  const filename = req.params.filename;
  const job = await queueGenStockBalanceReport.getJob(jobId);

  if (job && job.finishedOn) {
    const filePath = path.join(os.tmpdir(), filename);

    if (fs.existsSync(filePath)) {
      res.status(200).json({
        success: true,
        message: "File has been successfully generated",
        data: [],
      });
    } else {
      res.status(202).json({
        success: false,
        message: "regenerated",
        data: [],
      });
    }
  } else {
    res.status(200).json({
      success: false,
      message: "PDF generation in progress",
      data: [],
    });
  }
});

router.get("/download-stockbalance/:jobId/:filename", async (req, res) => {
  const jobId = req.params.jobId;
  const filename = req.params.filename;
  const tempPath = path.join(os.tmpdir(), `${filename}`);

  const job = await queueGenStockBalanceReport.getJob(jobId);

  if (job && job.finishedOn) {
    res.download(tempPath, `${filename}`, (err) => {
      if (err) {
        res.status(500).send("Something wrong with download. Please try again later");
      }
      //   fs.unlinkSync(tempPath); // Optionally delete the file after sending
    });
  } else {
    res.status(202).send("PDF is still being generated. Please try again later.");
  }
});


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
      var dataset = await data.dataresult(result.data.shopid, req.query.fromdate, req.query.todate, req.query.printby, req.query.showcost, req.query.frombarcode, req.query.tobarcode, res);
      res.status(200).json({ success: true, data: dataset });
    } catch (err) {
      res.status(500).json({ success: false, data: [], msg: err.message });
    }
  })
);

router.get("/pdfview", async (req, res) => {
  var result = await globalservice.getUserShop(req.query.token);
  if (!result.success) {
    res.status(401).json({ success: false, msg: "Invalid shop" });
    return;
  }
  console.log(result.data.shopid);
  data.pdfPreview(result.data.shopid, req.query.fromdate, req.query.todate, req.query.printby, req.query.showcost, req.query.frombarcode, req.query.tobarcode, res);
});

module.exports = router;
