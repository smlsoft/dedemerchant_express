const express = require("express");
const router = express.Router();
const utils = require("../../../utils");
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
router.get(
  "/",
  utils.catchAsync(async (req, res) => {
    const { origin, destination, key } = req.query;

    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&mode=DRIVING&destination=${destination}&key=${key}`;

    try {
      const response = await axios.get(directionsUrl);
      //console.log(response.data);
      if (response.status == 200) {
        const route = response.data.routes[0];
        const duration = route.legs[0].duration.text;
        const distance = route.legs[0].distance.value;
        const startLocation = route.legs[0].start_location;
        const endLocation = route.legs[0].end_location;

        const polyline = route.overview_polyline.points;

        const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&path=enc:${polyline}&markers=color:green|label:S|${startLocation.lat},${startLocation.lng}&markers=color:red|label:E|${endLocation.lat},${endLocation.lng}&key=${key}`;
        const responseImg = await axios.get(staticMapUrl, { responseType: "arraybuffer" });
        const base64Image = Buffer.from(responseImg.data, "binary").toString("base64");

        res.status(200).json({
          duration,
          distance: `${distance} meters`,
          imageBase64: `data:image/png;base64,${base64Image}`,
        });
      } else {
        res.status(500).send("Error fetching directions");
      }
    } catch (error) {
      res.status(500).send(error.toString());
    }
  })
);

module.exports = router;
