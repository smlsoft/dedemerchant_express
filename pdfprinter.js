const PdfPrinter = require("pdfmake");
const path = require("path");

const fonts = {
    Sarabun: {
      normal: path.join(__dirname, "fonts", "Sarabun-Regular.ttf"),
      bold: path.join(__dirname, "fonts", "Sarabun-Medium.ttf"),
      italics: path.join(__dirname, "fonts", "Sarabun-Italic.ttf"),
      bolditalics: path.join(__dirname, "fonts", "Sarabun-MediumItalic.ttf"),
    },
  };
  
  const printer = new PdfPrinter(fonts);

  module.exports = printer;