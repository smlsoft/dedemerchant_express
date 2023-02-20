const express = require("express");
const router = express.Router();
const products = require("../../product");
const uuid = require("uuid");
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;

const url = 'mongodb+srv://doadmin:8Lpfn6203W4U51XK@db-mongodb-sgp1-pos-356fc016.mongo.ondigitalocean.com/?tls=true';
const options = {
  ssl: true,
  tlsAllowInvalidHostnames: true,
  tlsCAFile: `${__dirname}/ca-certificate.crt`
};
router.get("/", (req, res) => {

  MongoClient.connect(url,options, (err, db) => {
    console.log('asfasfasf')
    if (err) throw err;
    // const dbo = db.db('dedepos');
    // console.log(db.db)
    // dbo.collection('products').find({}).toArray((err, result) => {
    //   if (err) throw err;
    //   res.send(result);
    //   db.close();
    // });
  });
});

router.get("/:id", (req, res) => {
  let found = products.some((products) => products.code == req.params.id);
  if (found) {
    res.json(products.filter((products) => products.code == req.params.id));
  } else {
    res.status(404).json({ msg: `No data found for ${req.params.id}` });
  }
});

router.post('/',(req, res) => {
  const newProduct = {
    code:uuid.v4(),
    names:req.body.names
  }
  res.json(newProduct);
});

module.exports = router;