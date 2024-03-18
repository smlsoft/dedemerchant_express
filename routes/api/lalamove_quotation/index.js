const express = require("express");
const router = express.Router();
const utils = require("../../../utils");
const axios = require("axios");
const CryptoJS = require("crypto-js");

router.get(
  "/",
  utils.catchAsync(async (req, res) => {
    if (req.query.slat === undefined || req.query.slng === undefined || req.query.clat === undefined || req.query.clng === undefined) {
      res.status(400).json({ success: false, data: [], msg: "Invalid request" });
    } else {
      const API_KEY = req.query.apikey;
      const SECRET = req.query.secret ;

      axios.defaults.baseURL = "https://rest.sandbox.lalamove.com"; 
      const time = new Date().getTime().toString();
      const region = "TH";
      const method = "POST";
      const path = "/v3/quotations";

      const body = JSON.stringify({
        data: {
          serviceType: "MOTORCYCLE",
          specialRequests: [],
          language: "th_TH",
          stops: [
            {
              coordinates: {
                lat: req.query.slat,
                lng: req.query.slng,
              },
              address: "Shop",
            },
            {
              coordinates: {
                lat: req.query.clat,
                lng: req.query.clng,
              },
              address: "Customer",
            },
          ],
        },
      });

      const rawSignature = `${time}\r\n${method}\r\n${path}\r\n\r\n${body}`;
      const SIGNATURE = CryptoJS.HmacSHA256(rawSignature, SECRET).toString();
      const startTime = new Date().getTime();
      try {
        axios
          .post(path, body, {
            headers: {
              "Content-type": "application/json; charset=utf-8",
              Authorization: `hmac ${API_KEY}:${time}:${SIGNATURE}`,
              Accept: "application/json",
              Market: region,
            },
          })
          .then((result) => {
            //console.log(result);
            if (result.status === 201) {
              // console.log("Total elapsed http request/response time in milliseconds: ", new Date().getTime() - startTime);
              // console.log("Authorization header: ", `hmac ${API_KEY}:${time}:${SIGNATURE}`);
              // console.log("Status Code: ", result.status);
              // console.log("Returned data: ", result.data);
              var dataset = {
                priceBreakdown: result.data.data.priceBreakdown,
                distance: result.data.data.distance,
              };
              res.status(200).json({ success: true, data: dataset });
            } else {
            
              res.status(500).json({ success: false, data: [], msg: "Error" });
            }
          })
          .catch((err) => {
           // console.log(err);
            res.status(500).json({ success: false, data: [], msg: err.message });
          });
      } catch (err) {
        res.status(500).json({ success: false, data: [], msg: err.message });
      }
    }
  })
);

module.exports = router;
