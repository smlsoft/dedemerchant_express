const express = require("express");
var bodyParser = require("body-parser");
const path = require("path");
const logger = require("./logger");
const utils = require("./utils");
const { Kafka, Partitioners } = require("kafkajs");
const dotenv = require("dotenv");
const balance = require("./routes/api/balance/data");
dotenv.config();
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');


const kafka = new Kafka({
  clientId: "my-app2",
  brokers: [process.env.BROKERS],
});


const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});
const consumer = kafka.consumer({ groupId: "dedemerchant" });

const app = express();

const server = require('http').createServer(app);

const fs = require("fs");


const gracefulShutdown = () => {
  console.log('Starting graceful shutdown...');
  
  // Close server to stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    
    console.log('Server closed. Exiting process.');
    process.exit(0);
  });
  
  // Forcefully terminate process after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time. Forcefully terminating process.');
    process.exit(1);
  }, 10 * 1000);
};

// Handle SIGINT (Ctrl+C) and SIGTERM signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

app.use(express.static(path.join(__dirname, "public")));
app.set("port", process.env.PORT || 8080);
app.use(bodyParser.json({ limit: "200mb" }));
app.use(bodyParser.urlencoded({ limit: "200mb", extended: true }));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

//app.use(logger);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const router = express.Router();

// middleware that is specific to this router
// router.use((req, res, next) => {
//   console.log('Time: ', Date.now())
//   next()
// })
router.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


router.post("/sendPDFEmail", async (req, res) => {
  console.log(req.body);
  try {
    await producer.connect();
    await producer.send({
      topic: "send-report",
      messages: [{ value: JSON.stringify(req.body)}],
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
        await sendReportCheck(jsonData)
      },
    });
    res.status(200).send("Listening for messages from Kafka");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error receiving messages from Kafka");
  }
});

router.use("/api/product", require("./routes/api/product"));
router.use("/api/balance", require("./routes/api/balance"));
router.use("/api/saleinvoice", require("./routes/api/sale"));
router.use("/api/productdetail", require("./routes/api/productdetail"));
router.use("/api/productbarcode", require("./routes/api/productbarcode_clickhouse"));
router.use("/api/debtor", require("./routes/api/debtor"));
router.use("/api/creditor", require("./routes/api/creditor"));
router.use("/api/bookbank", require("./routes/api/bookbank"));
router.use("/api/purchase", require("./routes/api/purchase"));
router.use("/api/purchasereturn", require("./routes/api/purchase_return"));
router.use("/api/saleinvoicereturn", require("./routes/api/sale_return"));
router.use("/api/transfer", require("./routes/api/transfer"));
router.use("/api/receive", require("./routes/api/receive"));
router.use("/api/pickup", require("./routes/api/pickup"));
router.use("/api/returnproduct", require("./routes/api/stock_return_product"));
router.use("/api/stockadjustment", require("./routes/api/stock_adjustment"));
router.use("/api/paid", require("./routes/api/paid"));
router.use("/api/pay", require("./routes/api/pay"));

app.get("/healthcheck", (req, res) => {
  res.status(200).send("OK");
});


app.use("/apireport", router);

const sendReportCheck = async (data) => {
  if(data.report != undefined){
    if(data.report == 'balance'){
      await balance.sendEmail(data.email)
    }
  }else{
    res.status(500).send("command not found");
  }
}

app.listen(app.get("port"), function () {
  console.log("run at port", app.get("port"));
});
