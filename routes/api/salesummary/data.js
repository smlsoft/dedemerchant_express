
const { createClient } = require("@clickhouse/client");
const dotenv = require("dotenv");
dotenv.config();
const client = new createClient({
  host: process.env.CH_SERVER_ADDRESS,
  username: process.env.CH_USERNAME,
  password: process.env.CH_PASSWORD,
  database: process.env.CH_DATABASE_NAME,
});

const dataresult = async (pin) => {
  const query = `select '10000' as cash `;

  const resultSet = await client.query({
    query: query,
    format: "JSONEachRow",
  });
  const dataset = await resultSet.json();
  console.log(dataset);
  return dataset;
};

module.exports = { dataresult };
