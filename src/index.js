const path = require("path");
const clients = require("../config/clients.json");
const { getData } = require("./collector");
const { normalizeClientData } = require("./normalizer.js");
const { saveNormalizedDataToCSV } = require("./exporter");
const {
  saveSnapshot,
  getPreviousSnapshot,
  compareSnapshots,
} = require("./snapshot");
const { mergeLicenses } = require("./license");
const { generateAllReports } = require("./reporter");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

(async () => {
  const diffResultsMap = new Map();

  await Promise.all(
    clients.map(async (x) => {
      const username = process.env[x.username_env];
      const password = process.env[x.application_password];
      const credentials = Buffer.from(`${username}:${password}`).toString(
        "base64",
      );

      try {
        const rawData = await getData(x.url, credentials);
        let normalized = normalizeClientData(x, rawData, null);

        normalized.plugins = mergeLicenses(normalized.plugins);

        const priorSnapshot = getPreviousSnapshot(x.client_id);
        const diffResult = compareSnapshots(normalized, priorSnapshot);
        diffResultsMap.set(x.client_id, diffResult);

        saveSnapshot(normalized);
        saveNormalizedDataToCSV(normalized);
      } catch (err) {
        normalizeClientData(x, null, err.message);
        console.error(`Failed to process ${x.client_id}:`, err.message);
      }
    }),
  );

  generateAllReports(diffResultsMap);
})();
