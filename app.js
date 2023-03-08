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

const fs = require("fs");

app.use(express.static(path.join(__dirname, "public")));
app.set("port", process.env.PORT || 3333);
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

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/sendPDFEmail", async (req, res) => {
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
app.get("/sendPDFEmail", async (req, res) => {
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

app.use("/api/balance", require("./routes/api/balance"));

app.get("/healthcheck", (req, res) => {
  res.status(200).send("OK");
});


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
