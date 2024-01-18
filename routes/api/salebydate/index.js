const express = require("express");
const router = express.Router();
const data = require("./data");
const globalservice = require("../../../globalservice");
const Queue = require("bull");

const utils = require("../../../utils");
const fs = require("fs");
const os = require("os");
const path = require("path");
const queueGenSaleByDateReport = new Queue("genSaleByDateReport", process.env.RADIS_QUEUE_URI);
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
  // console.log(payload);
  const jobId = payload.data.fileName;
  data.genDownLoadSaleByDatePDF(payload.data.shopid, payload.data.search, payload.data.fromdate, payload.data.todate, payload.data.fileName);
  return { jobId };
});

queueGenSaleByDateReport.on("completed", (job, result) => {
  console.log(`Job completed with result ${result}`);
});

queueGenSaleByDateReport.on("failed", (job, err) => {
  console.log(`Job failed with error ${err.message}`);
});

router.get("/genPDFSaleByDate", async (req, res) => {
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (!result.success) {
      res.status(401).json({ success: false, msg: "Invalid shop" });
      return;
    }

    let fileName = `salebydate-${result.data.name}-${utils.currentTimeStamp(Date.now())}.pdf`;
    let payload = {
      fileName: fileName,
      shopid: result.data.shopid,
      search: req.query.search,
      fromdate: req.query.fromdate,
      todate: req.query.todate,
    };

    const protocol = req.protocol;
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
          data: { fileName: fileName, downloadLink: `${protocol}://${host}${desiredPath}download-pdf/${fileName}` },
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

router.get("/download-pdf/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const tempPath = path.join(os.tmpdir(), `${jobId}`);
  console.log(tempPath);
  // Check if the PDF is ready

  const job = await queueGenSaleByDateReport.getJob(jobId);
  console.log(job);
  if (job && job.finishedOn) {
    // File is ready, send it to the user
    res.download(tempPath, `${jobId}`, (err) => {
      if (err) {
        res.status(500).send("File is processing.");
      }
        fs.unlinkSync(tempPath); // Optionally delete the file after sending
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
