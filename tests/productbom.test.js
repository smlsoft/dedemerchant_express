const e = require("express");
const data = require("../routes/api/productbom/data");

let dataMock = {
    "01": {
      guidfixed: "guid1",
      barcode: "01",
      names: [{ code: "en", name: "name01" }],
      itemunitcode: "unit01",
      itemuintnames: [{ code: "en", name: "unit01" }],
      bom: [
        { barcode: "02" }, // These would be more detailed in a full implementation
      ],
    },
    "02": {
      guidfixed: "guid2",
      barcode: "02",
      names: [{ code: "en", name: "name02" }],
      itemunitcode: "unit02",
      itemuintnames: [{ code: "en", name: "unit02" }],
      bom: [
        { barcode: "03" },
      ],
    },
    "03": {
      guidfixed: "guid3",
      barcode: "03",
      names: [{ code: "en", name: "name03" }],
      itemunitcode: "unit03",
      itemuintnames: [{ code: "en", name: "unit03" }],
      bom: [
        { barcode: "04" },
        { barcode: "05" },
      ],
    },
    "04": {
      guidfixed: "guid4",
      barcode: "04",
      names: [{ code: "en", name: "name04" }],
      itemunitcode: "unit04",
      itemuintnames: [{ code: "en", name: "unit04" }],
      // No bom for 04 in the example
    },
    "05": {
      guidfixed: "guid5",
      barcode: "05",
      names: [{ code: "en", name: "name05" }],
      // No bom for 05 in the example
    }
  };


async function findByBarcode(shopID, barcode) {
  const productBarcodeDoc = dataMock[barcode];
  if (!productBarcodeDoc) {
    throw new Error("Barcode not found");
  }
  return productBarcodeDoc;
}

describe('buildBOMView Tests', () => {

    test('buildBOMView Functionality', async () => {
  
      let bomView = await data.buildBOMView(findByBarcode, 0, "shopID", "01");
  

      expect(bomView).not.toBeNull();
      expect(bomView.barcode).toBe("01");
      expect(bomView.bom[0].barcode).toBe("02");
      expect(bomView.bom[0].bom[0].barcode).toBe("03");
      expect(bomView.bom[0].bom[0].bom[0].barcode).toBe("04");
      expect(bomView.bom[0].bom[0].bom[1].barcode).toBe("05");
    });
  });
  