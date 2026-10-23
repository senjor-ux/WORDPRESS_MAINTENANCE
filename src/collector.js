// Fetches data from WordPress REST API & custom endpoint
const path = require("path");
const { normalizeClientData } = require("./normalizer.js");
const { saveNormalizedDataToCSV } = require("./exporter");
const clients = require("../config/clients.json");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const getData = (url, credentials) => {
  return fetch(`${url}/wp-json/agency/v1/maintenance-status`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  }).then((res) => {
    if (!res.ok) throw new Error(`HTTP Error. Status: ${res.status}`);
    return res.json();
  });
};

(async () => {
  console.log(
    `Starting collector... Found ${clients.length} clients to process.`,
  );

  await Promise.all(
    clients.map(async (x) => {
      const username = process.env[x.username_env];
      const password = process.env[x.application_password];

      const credentials = Buffer.from(`${username}:${password}`).toString(
        "base64",
      );

      try {
        const rawData = await getData(x.url, credentials);
        const normalized = normalizeClientData(x, rawData, null);
        saveNormalizedDataToCSV(normalized);
        console.log(`CSV reports generated for: ${x.client_id}`);
      } catch (err) {
        const failedNormalization = normalizeClientData(x, null, err.message);
        console.error(`Failed to process ${x.client_id}:`, err.message);
      }
    }),
  );
})();
