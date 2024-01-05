const provider = require("../../../provider");
const utils = require("../../../utils");

const dataresult = async (shopid, creditorcode) => {

    const pg = await provider.connectPG();

    var query = `select transflag::int as transflag8, * from creditor_transaction where shopid = '${shopid}' and creditorcode = '${creditorcode}' `;

    console.log(query);

    try {
        await pg.connect();
        const result = await pg.query(query);

        console.log(result.rows);

        return result.rows;
    } catch (error) {
        console.log(error);
        throw error;
    } finally {
        await pg.end();
    }
};

module.exports = { dataresult };
