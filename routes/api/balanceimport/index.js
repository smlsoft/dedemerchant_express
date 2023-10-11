const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const utils = require("../../../utils");
const fs = require("fs");
const data = require("./data");
const printer = require("../../../pdfprinter");
var bodyParser = require("body-parser");
const multer = require("multer");
const XLSX = require("xlsx");

const provider = require("../../../provider");

const storage = multer.memoryStorage(); // store the file as a buffer in memory
const upload = multer({ storage: storage });

router.get("/", async (req, res) => {
  try {
    var dataset = await data.dataresult();
    res.status(200).json({ success: true, data: dataset, msg: "" });
  } catch (err) {
    res.status(500).json({ success: false, data: [], msg: err.message });
  }
});

router.post("/upload", upload.single("uploadfile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const workbook = XLSX.read(req.file.buffer, { type: "buffer" });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  var excelData = [];

  data.forEach((row) => {
    excelData.push({
      barcode: row.บาร์โค้ด,
      itemnames: [{ code: "th", name: row.ชื่อสินค้า }],
      unitcode: row.รหัสหน่วยนับ,
      qty: parseFloat(row.จำนวน).toFixed(2),
      cost: parseFloat(row.ต้นทุน).toFixed(2),
      amount: parseFloat(row.รวม).toFixed(2),
    });
  });

  var partSize = 100;
  let postData = {
    totalitem: excelData.length,
    partsize: partSize,
  };

  let totalItemResult = await provider
    .instanceApi(req.query.token)
    .post(`/stockbalanceimport/task`, postData)
    .then((res) => res.data);

  console.log(totalItemResult);
  if (totalItemResult.success) {
    var productData = totalItemResult.data;
    var partindex = 0;
    var productindex = 0;
    excelData.forEach((product) => {
      if (productindex == partSize) {
        partindex++;
        productindex = 0;
      }
      if (productindex == 0) {
        productData.parts[partindex].products = [];
        //  console.log(product);
      }
      product.qty = parseFloat(product.qty);
      product.cost = parseFloat(product.cost);
      product.amount = parseFloat(product.amount);

      productData.parts[partindex].products.push(product);
      productindex++;
    });

    try {
      const results = await Promise.all(productData.parts.map((products) => asyncSendTask(req.query.token, products)));

      res.json({ success: true, taskid:productData.taskid,chunksize:productData.chunksize, totalitem: productData.totalitem, partsize:productData.parts.length ,updatepartdone:results.length });
    } catch (err) {
      console.log(err);
      res.json({ success: false, msg: "error on updateitem " + err });
    }
  } else {
    res.json({ success: false, msg: "no data found" });
  }
});

const asyncSendTask = (token, product) => {
  return new Promise((resolve) => {
    provider
      .instanceApi(token)
      .put(`/stockbalanceimport/task/part/` + product.partid, JSON.stringify(product.products))
      .then((res) => resolve(res.data));
  });
};

const sendTask = async (productData) => {
  var sendIndex = 0;
  var returnvalue = [];

  var resTask = await provider
    .instanceApi(req.query.token)
    .put(`/stockbalanceimport/task/part/` + partid, JSON.stringify(products))
    .then((res) => res.data);
  return resTask;
};

router.get("/pdfview", async (req, res) => {
  console.log("pdfview");
  data.pdfPreview(res);
});

router.get("/pdfdownload", async (req, res) => {
  console.log("pdfdownload");
  data.pdfDownload(res);
});

module.exports = router;
