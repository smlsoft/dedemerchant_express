const express = require("express");
var bodyParser = require("body-parser");
const path = require("path");

const logger = require("./logger");
const e = require("express");
const app = express();

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
app.use(express.urlencoded({extended:false}));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

app.use('/api/products',require('./routes/api/products'))

app.get("/healthcheck", (req, res) => {
  res.status(200).send('OK');
});

app.listen(app.get("port"), function () {
  console.log("run at port", app.get("port"));
});
