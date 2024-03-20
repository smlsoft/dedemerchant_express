const express = require("express");
const router = express.Router();
const utils = require("../../../utils");
const axios = require("axios");
const CryptoJS = require("crypto-js");
const moment = require("moment-timezone");

router.get(
  "/",
  utils.catchAsync(async (req, res) => {
    res.status(200).json({ success: true, data: [] });
  })
);

router.post(
  "/",
  utils.catchAsync(async (req, res) => {
    // console.log(req.body)
    if (
      req.body.slat === undefined ||
      req.body.slng === undefined ||
      req.body.clat === undefined ||
      req.body.clng === undefined ||
      req.body.apikey === undefined ||
      req.body.secret === undefined ||
      req.body.type === undefined
    ) {
      res.status(400).json({ success: false, data: [], msg: "Invalid request" });
    } else {
      const API_KEY = req.body.apikey;
      const SECRET = req.body.secret;

      axios.defaults.baseURL = "https://rest.sandbox.lalamove.com";
      const time = new Date().getTime().toString();
      const region = "TH";
      const method = "POST";
      const path = "/v3/quotations";
      var data = {
        serviceType: req.body.type,
        specialRequests: [],
        isRouteOptimized: true, 
        language: "th_TH",
        item: {
          quantity: "1",
          weight: "LESS_THAN_100KG",
          categories: ["FOOD_DELIVERY"],
          handlingInstructions: []
        },
        stops: [
          {
            coordinates: {
              lat: req.body.slat,
              lng: req.body.slng,
            },
            address: "Shop",
          },
          {
            coordinates: {
              lat: req.body.clat,
              lng: req.body.clng,
            },
            address: "Customer",
          },
        ],
      };

      if (req.body.schedule != undefined && req.body.schedule != "") {
        const dateschedule = new Date(req.body.schedule);
        const utcTime = dateschedule.toISOString();
        data.scheduleAt = utcTime;
      }

      const body = JSON.stringify({ data });

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
            console.log(result);
            const utcTime = result.data.data.expiresAt;
            const thaiTime = moment(utcTime).tz("Asia/Bangkok").format();
            if (result.status === 201) {
              // console.log("Total elapsed http request/response time in milliseconds: ", new Date().getTime() - startTime);
              // console.log("Authorization header: ", `hmac ${API_KEY}:${time}:${SIGNATURE}`);
              // console.log("Status Code: ", result.status);
              // console.log("Returned data: ", result.data);
              var dataset = {
                expiresAt: thaiTime,
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
