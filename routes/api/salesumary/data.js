const provider = require("../../../provider");
const utils = require("../../../utils");

const dataresult = async (shopid) => {

  const pg = await provider.connectPG();
  
  var query = `select '1000000' as dailysale, '2000000' as monthlysale, '3000000' as yearlysale`;
  console.log(query)
  try {
    console.log(query)
    await pg.connect();

    const result = await pg.query(query);
    console.log(result)
    return result.rows;
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await pg.end();
  }
};

module.exports = { dataresult };
