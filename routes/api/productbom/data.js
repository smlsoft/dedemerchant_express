const provider = require("../../../provider");

const findByBarcode = async (shopID, barcode) => {
    const client = await provider.connectPG();
    const query = {
        text: `SELECT * FROM productbom WHERE shopid $1 AND barcode = $2`,
        values: [shopID,barcode],
    };

    const resultSet = await client.query(query);

    if (resultSet.rows.length === 0) {
        throw new Error("Barcode not found");
    }

    const dataset = resultSet.rows[0];
    return dataset;
}

const buildBOMView = async (
    findByBarcode,
    currentLevel,
    shopID,
    barcode
  )  => {
    let bomView = {};

    try {
    const findDoc = await findByBarcode(shopID, barcode);

    bomView = parseProductToBomView(findDoc);

    if ('bom' in findDoc && findDoc['bom'].length > 0) {
        for (const bom of findDoc['bom']) {
            const childBom = await buildBOMView(findByBarcode, currentLevel + 1, shopID, bom.barcode);
            bomView['bom'].push(childBom);
        }
    } 
    }catch (error) {
        throw error;
    }

    return bomView;
  }
  
  function parseProductToBomView(product) {
    return {
        barcode: product.barcode,
        names: product.names,
        itemunitcode: product.itemunitcode,
        itemunitnames: product.itemunitnames,
        bom: [],
    };
  }

  module.exports = {buildBOMView, findByBarcode};