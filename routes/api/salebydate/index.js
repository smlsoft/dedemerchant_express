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
const queueGenSaleByDateReport = new Queue("genSaleByDate", process.env.REDIS_CACHE_URI + "?tls=" + process.env.REDIS_CACHE_TLS_ENABLE);
const queueGenReceiveByDateReport = new Queue("genSaleByDate", process.env.REDIS_CACHE_URI + "?tls=" + process.env.REDIS_CACHE_TLS_ENABLE);

router.get("/", async (req, res) => {
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }
    var dataset = await data.salebydate(result.data.shopid, req.query.search, req.query.fromdate, req.query.todate);
    res.status(200).json({ success: true, data: dataset.data, msg: "" });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
});

queueGenSaleByDateReport.process(async (payload) => {
  logger.info("on sale process");

  const jobId = payload.data.fileName;

  data.genDownLoadSaleByDatePDF(payload.data.shopid, payload.data.search, payload.data.fromdate, payload.data.todate, payload.data.fileName);

  return { jobId };
});

queueGenReceiveByDateReport.process(async (payload) => {
  logger.info("on receive process");

  const jobId = payload.data.fileName;

  data.genDownLoadReceiveByDatePDF(payload.data.shopid, payload.data.search, payload.data.fromdate, payload.data.todate, payload.data.fileName);

  return { jobId };
});

queueGenSaleByDateReport.on("completed", (job, result) => {
  logger.info(`Job Sale completed with result ${result}`);
});

queueGenSaleByDateReport.on("failed", (job, err) => {
  logger.error(`Job Sale failed with error `, err.message);
});

queueGenReceiveByDateReport.on("completed", (job, result) => {
  logger.info(`Job Receive completed with result ${result}`);
});

queueGenReceiveByDateReport.on("failed", (job, err) => {
  logger.error(`Job Receive failed with error `, err.message);
});

router.get("/genPDFSaleByDate", async (req, res) => {
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }

    let fileName = `salebydate-${result.data.name}-${utils.formateDateTime(Date.now())}.pdf`;

    let payload = {
      fileName: fileName,
      shopid: result.data.shopid,
      search: req.query.search,
      fromdate: req.query.fromdate,
      todate: req.query.todate,
    };

    const protocol = "https";
    const host = req.get("host"); // Includes hostname and port
    const originalUrl = req.originalUrl;
    const parts = originalUrl.split("/");
    const desiredPath = `/${parts[1]}/${parts[2]}/`;

    queueGenSaleByDateReport
      .add(payload, { jobId: fileName })
      .then((job) => {
        console.log(`Job added with ID: ${job.id}`);
        res.status(200).json({
          success: true,
          message: "PDF generation in progress",
          data: { fileName: fileName, downloadLink: `${protocol}://${host}${desiredPath}download-salebydate/${fileName}` },
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

router.get("/genPDFReceiveByDate", async (req, res) => {
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }

    let fileName = `receivemoney-${result.data.name}-${utils.formateDateTime(Date.now())}.pdf`;

    let payload = {
      fileName: fileName,
      shopid: result.data.shopid,
      search: req.query.search,
      fromdate: req.query.fromdate,
      todate: req.query.todate,
    };

    const protocol = "https";
    const host = req.get("host"); // Includes hostname and port
    const originalUrl = req.originalUrl;
    const parts = originalUrl.split("/");
    const desiredPath = `/${parts[1]}/${parts[2]}/`;

    queueGenReceiveByDateReport
      .add(payload, { jobId: fileName })
      .then((job) => {
        console.log(`Job added with ID: ${job.id}`);
        res.status(200).json({
          success: true,
          message: "PDF generation in progress",
          data: { fileName: fileName, downloadLink: `${protocol}://${host}${desiredPath}download-receive/${fileName}` },
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

router.get("/check-salebydate/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const tempPath = path.join(os.tmpdir(), `${jobId}`);

  const job = await queueGenSaleByDateReport.getJob(jobId);

  if (job && job.finishedOn) {
    const filePath = path.join(os.tmpdir(), jobId);

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

router.get("/download-salebydate/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const tempPath = path.join(os.tmpdir(), `${jobId}`);

  const job = await queueGenSaleByDateReport.getJob(jobId);

  if (job && job.finishedOn) {
    res.download(tempPath, `${jobId}`, (err) => {
      if (err) {
        res.status(500).send("Something wrong with download. Please try again later");
      }
      //   fs.unlinkSync(tempPath); // Optionally delete the file after sending
    });
  } else {
    res.status(202).send("PDF is still being generated. Please try again later.");
  }
});

router.get("/check-receive/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const tempPath = path.join(os.tmpdir(), `${jobId}`);

  const job = await queueGenReceiveByDateReport.getJob(jobId);

  if (job && job.finishedOn) {
    const filePath = path.join(os.tmpdir(), jobId);

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

router.get("/download-receive/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const tempPath = path.join(os.tmpdir(), `${jobId}`);

  const job = await queueGenReceiveByDateReport.getJob(jobId);

  if (job && job.finishedOn) {
    res.download(tempPath, `${jobId}`, (err) => {
      if (err) {
        res.status(500).send("Something wrong with download. Please try again later");
      }
      //   fs.unlinkSync(tempPath); // Optionally delete the file after sending
    });
  } else {
    res.status(202).send("PDF is still being generated. Please try again later.");
  }
});

router.get("/sale", async (req, res) => {
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }
    var dataset = await data.salebydate(result.data.shopid, req.query.search, req.query.fromdate, req.query.todate);
    res.status(200).json({ success: true, data: dataset.data, msg: "" });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
});

router.get("/sale/pdfview", async (req, res) => {
  var result = await globalservice.getUserShop(req.query.token);
  if (!result.success) {
    res.status(401).json({ success: false, msg: "Invalid shop" });
    return;
  }
  data.pdfPreview(result.data.shopid, req.query.search, req.query.fromdate, req.query.todate, res);
});

router.get("/sale/pdfdownload", async (req, res) => {
  var result = await globalservice.getUserShop(req.query.token);
  if (!result.success) {
    res.status(401).json({ success: false, msg: "Invalid shop" });
    return;
  }
  data.pdfDownload(result.data.shopid, req.query.search, req.query.fromdate, req.query.todate, res);
});

router.get("/receivemoney", async (req, res) => {
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }
    var dataset = await data.receivemoney(result.data.shopid, req.query.search, req.query.fromdate, req.query.todate);
    res.status(200).json({ success: true, data: dataset.data, msg: "" });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
});

router.get("/receivemoney/pdfview", async (req, res) => {
  var result = await globalservice.getUserShop(req.query.token);
  if (!result.success) {
    res.status(401).json({ success: false, msg: "Invalid shop" });
    return;
  }
  data.pdfPreviewReceivemoney(result.data.shopid, req.query.search, req.query.fromdate, req.query.todate, res);
});

module.exports = router;
