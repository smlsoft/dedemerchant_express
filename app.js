const express = require("express");
var bodyParser = require("body-parser");
const dotenv = require("dotenv");
dotenv.config();
const path = require("path");
const logger = require("./logger");
const utils = require("./utils");
const { Kafka, Partitioners } = require("kafkajs");
const balance = require("./routes/api/balance/data");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const { Client } = require("pg");
const snoowrap = require("snoowrap");
const axios = require("axios");
const globalservice = require("./globalservice");

const kafka = new Kafka({
  clientId: "my-app2",
  brokers: [process.env.BROKERS],
});

const uri = process.env.MONGODB_URI + "/?ssl=true";

const connectToMongoDB = async () => {
  try {
    var options = {};
    console.log(process.env.MONGODB_SSL);
    if (process.env.MONGODB_SSL == "true") {
      options = {
        tls: true,
        tlsCAFile: process.env.MONGODB_TLS_CA_FILE,
      };
    }
    console.log(options);
    const client = new MongoClient(uri, options);
    await client.connect();
    let db;
    //console.log("Connected to MongoDB successfully");
    logger.info("Connected to MongoDB successfully");
    db = client.db(process.env.MONGODB_DB);

    const transactionPaid = db.collection("transactionPaid");
    const transactionPurchaseReturn = db.collection("transactionPurchaseReturn");
    const transactionSaleInvoice = db.collection("transactionSaleInvoice");

    const result = await transactionPaid
      .aggregate([
        {
          $unionWith: {
            coll: "transactionPurchaseReturn",
            pipeline: [
              {
                $match: {
                  inquirytype: {
                    $in: [2, 3],
                  },
                },
              },
            ],
          },
        },
        {
          $unionWith: {
            coll: "transactionSaleInvoice",
            pipeline: [
              {
                $match: {
                  inquirytype: 1,
                },
              },
            ],
          },
        },
        {
          $match: {
            $and: [
              {
                docdatetime: {
                  $gte: new Date("2023-06-13T00:00:00Z"),
                },
              },
              {
                docdatetime: {
                  $lt: new Date("2023-06-13T23:59:59Z"),
                },
              },
              {
                custcode: {
                  $gte: "AR001",
                },
              },
              {
                custcode: {
                  $lte: "AR002",
                },
              },
              {
                shopid: {
                  $lte: "2QxLk9hpoJ0CiIMqiqroqkqw628",
                },
              },
            ],
          },
        },
      ])
      .toArray();

    const data = await transactionPaid.find({}).toArray();
    const data2 = await transactionPurchaseReturn.find({}).toArray();
    const data3 = await transactionSaleInvoice.find({}).toArray();

    await client.close();

    console.log(result);
    return result;
    console.log("Disconnected from MongoDB");
  } catch (error) {
    logger.error("Error connecting to MongoDB:", error);
  }
};

const connectToPostgres = async () => {
  const pg = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB_NAME,
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
  });
  try {
    await pg.connect();
    const query = "SELECT shopid FROM chartofaccounts where shopid != '' limit 1";
    const result = await pg.query(query);
    return result.rows;
  } catch (error) {
    throw error;
  } finally {
    await pg.end();
  }
};

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});
const consumer = kafka.consumer({ groupId: "dedemerchant" });

const app = express();

const server = require("http").createServer(app);

const gracefulShutdown = () => {
  console.log("Starting graceful shutdown...");
  globalservice.redisClient.quit();

  // Close server to stop accepting new connections
  server.close((err) => {
    if (err) {
      //console.error("Error during server close:", err);
      logger.error("Error during server close:", err);
      process.exit(1);
    }

    console.log("Server closed. Exiting process.");
    process.exit(0);
  });

  // Forcefully terminate process after 10 seconds
  setTimeout(() => {
    console.error("Could not close connections in time. Forcefully terminating process.");
    process.exit(1);
  }, 10 * 1000);
};

// Handle SIGINT (Ctrl+C) and SIGTERM signals
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

app.use(express.static(path.join(__dirname, "public")));
app.set("port", process.env.PORT || 8080);
app.use(bodyParser.json({ limit: "200mb" }));
app.use(bodyParser.urlencoded({ limit: "200mb", extended: true }));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const router = express.Router();
// middleware that is specific to this router
// router.use((req, res, next) => {
//   console.log('Time: ', Date.now())
//   next()
// })

const logRequest = (req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const { method, url } = req;
    const status = res.statusCode;
    const contentLength = res.get("Content-Length");

    logger.info(`${method} ${url}`, { method, url, status, contentLength, duration });
  });

  return next();
};
app.use(logRequest);

globalservice.redisClient.connect();

globalservice.redisClient.on("error", (err) => {
  console.log("Redis Client Error", err);
  logger.error("Redis Client Error", err);
});
globalservice.redisClient.on("connect", () => {
  logger.debug("Connected to Redis");
});

router.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

router.get("/mongo", async (req, res) => {
  let result = await connectToMongoDB();
  res.status(200).json(result);
});

router.get("/pg", async (req, res) => {
  var resultSet = { success: false, data: null };
  try {
    const result = await connectToPostgres();
    resultSet.success = true;
    resultSet.data = result;
    res.send(resultSet);
  } catch (error) {
    console.error("Error executing database query", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/sendPDFEmail", async (req, res) => {
  console.log(req.body);
  try {
    await producer.connect();
    await producer.send({
      topic: "send-report",
      messages: [{ value: JSON.stringify(req.body) }],
    });
    await producer.disconnect();
    console.log("Send message:", " From Kafka");
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);

    res.status(500).json({ success: false });
  }
});

// Receive messages from a Kafka topic
router.get("/sendPDFEmail", async (req, res) => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "send-report", fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ message }) => {
        var jsonData = JSON.parse(message.value.toString());
        console.log("Received message:", jsonData);
        await sendReportCheck(jsonData);
      },
    });
    res.status(200).send("Listening for messages from Kafka");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error receiving messages from Kafka");
  }
});

router.use("/product", require("./routes/api/product"));
router.use("/balance", require("./routes/api/balance"));
router.use("/saleinvoice", require("./routes/api/sale"));
router.use("/salebydate", require("./routes/api/salebydate"));
router.use("/productdetail", require("./routes/api/productdetail"));
router.use("/poscenter", require("./routes/api/posactive"));

router.use("/productbarcode", require("./routes/api/productbarcode_clickhouse"));
router.use("/debtor", require("./routes/api/debtor"));
router.use("/creditor", require("./routes/api/creditor"));
router.use("/bookbank", require("./routes/api/bookbank"));
router.use("/purchase", require("./routes/api/purchase"));
router.use("/purchasereturn", require("./routes/api/purchase_return"));
router.use("/saleinvoicereturn", require("./routes/api/sale_return"));
router.use("/transfer", require("./routes/api/transfer"));
router.use("/receive", require("./routes/api/receive"));
router.use("/pickup", require("./routes/api/pickup"));
router.use("/returnproduct", require("./routes/api/stock_return_product"));
router.use("/stockadjustment", require("./routes/api/stock_adjustment"));
router.use("/paid", require("./routes/api/paid"));
router.use("/pay", require("./routes/api/pay"));
router.use("/movement", require("./routes/api/movement"));
router.use("/getpaid", require("./routes/api/getpaid"));
router.use("/getpay", require("./routes/api/getpay"));
router.use("/salesummary", require("./routes/api/salesummary"));
router.use("/salesummarypg", require("./routes/api/salesummarypg"));
router.use("/salesummarymg", require("./routes/api/salesummarymg"));
router.use("/productbalance", require("./routes/api/productbalance"));
router.use("/bestseller", require("./routes/api/bestseller"));
router.use("/vatsale", require("./routes/api/vat_sale"));
router.use("/vatpurchase", require("./routes/api/vat_purchase"));
router.use("/salebydebtor", require("./routes/api/salebydebtor"));
router.use("/cancel", require("./routes/api/cancel"));
router.use("/balanceimport", require("./routes/api/balanceimport"));
router.use("/health", require("./routes"));
router.use("/debtortransaction", require("./routes/api/debtor_transaction"));
router.use("/creditortransaction", require("./routes/api/creditor_transaction"));

router.get("/getUserShop", async (req, res) => {
  //8be917f9e93923fb18a7a1b74716c4c506cc4e97d982840cd26f0d37c60b11d2
  //3e1a8e2e1f37054603176b88c1be8e4b4f33024a01fb91422059e33d0c8e65b7
  try {
    var result = await globalservice.getUserShop(req.query.token);
    if (result.success) {
      res.status(200).send({ success: true, data: result.data });
    } else {
      res.status(200).send({ success: false, msg: result.msg });
    }
  } catch (error) {
    res.status(500).send("Error getting value from Redis");
  }
});

app.get("/healthcheck", (req, res) => {
  res.status(200).send("OK");
});
app.use("/apireport", router);

const sendReportCheck = async (data) => {
  if (data.report != undefined) {
    if (data.report == "balance") {
      await balance.sendEmail(data.email);
    }
  } else {
    res.status(500).send("command not found");
  }
};

app.listen(app.get("port"), function () {
  logger.info("Node app is running on port " + app.get("port"));
  //console.log("run at port", app.get("port"));
});
