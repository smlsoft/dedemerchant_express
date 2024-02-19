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
const queueGenSaleReport = new Queue("dedemerchantSaleInvReport", process.env.REDIS_CACHE_URI + "?tls=" + process.env.REDIS_CACHE_TLS_ENABLE);

queueGenSaleReport.process(async (payload) => {
  logger.info("on process");
  data.genDownLoadSaleInvPDF(
    payload.data.shopid,
    payload.data.fromdate,
    payload.data.todate,
    payload.data.fileName,
    payload.data.showdetail,
    payload.data.branchcode,
    payload.data.iscancel,
    payload.data.inquirytype,
    payload.data.ispos
  );
});

queueGenSaleReport.on("completed", (job, result) => {
  logger.info(`Job Sale completed with result ${result}`);
});

queueGenSaleReport.on("failed", (job, err) => {
  logger.error(`Job Sale failed with error `, err.message);
});

router.get("/genPDFSale", async (req, res) => {
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }

    let fileName = `saleinv-${result.data.name}-${utils.formateDateTime(Date.now())}.pdf`;
  
    let payload = {
      fileName: fileName,
      shopid: result.data.shopid,
      fromdate: req.query.fromdate,
      todate: req.query.todate,
      showdetail: req.query.showdetail,
      branchcode: req.query.branchcode,
      iscancel: req.query.iscancel,
      inquirytype: req.query.inquirytype,
      ispos: req.query.ispos,
    };

    const protocol = "https";
    const host = req.get("host"); // Includes hostname and port
    const originalUrl = req.originalUrl;
    const parts = originalUrl.split("/");
    const desiredPath = `/${parts[1]}/${parts[2]}/`;

    queueGenSaleReport
      .add(payload)
      .then((job) => {
        console.log(`Job added with ID: ${job.id}`);
        res.status(200).json({
          success: true,
          message: "PDF generation in progress",
          data: { fileName: fileName, jobId: job.id, downloadLink: `${protocol}://${host}${desiredPath}download-saleinv/${job.id}/${fileName}` },
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

router.get("/check-saleinv/:jobId/:filename", async (req, res) => {
  const jobId = req.params.jobId;
  const filename = req.params.filename;
  const job = await queueGenSaleReport.getJob(jobId);

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

router.get("/download-saleinv/:jobId/:filename", async (req, res) => {
  const jobId = req.params.jobId;
  const filename = req.params.filename;
  const tempPath = path.join(os.tmpdir(), `${filename}`);

  const job = await queueGenSaleReport.getJob(jobId);

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

router.get("/", async (req, res) => {
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pagesize) || 10;

    var dataset = await data.dataresult(result.data.shopid, req.query.fromdate, req.query.todate, req.query.showdetail, req.query.branchcode, req.query.iscancel, req.query.inquirytype, req.query.ispos);
    res.status(200).json({ success: true, data: dataset.data, msg: "" });
  } catch (err) {
    res.status(500).json({ success: false, data: [], pagination: { perPage: 0, page: 0, total: 0, totalPage: 0 }, msg: err.message });
  }
});

router.get("/pdfview", async (req, res) => {
  var result = await globalservice.getUserShop(req.query.token);
  if (!result.success) {
    res.status(401).json({ success: false, msg: "Invalid shop" });
    return;
  }
  data.pdfPreview(result.data.shopid, req.query.fromdate, req.query.todate, req.query.showdetail, req.query.branchcode, req.query.iscancel, req.query.inquirytype, req.query.ispos, res);
});

router.get("/pdfdownload", async (req, res) => {
  console.log("pdfdownload");
  data.pdfDownload(req.query.auth, req.query.search, res);
});

module.exports = router;
