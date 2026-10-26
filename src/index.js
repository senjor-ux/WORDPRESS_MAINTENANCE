const path = require("path");
const clients = require("../config/clients.json");
const { getData } = require("./collector");
const { normalizeClientData } = require("./normalizer.js");
const { saveNormalizedDataToCSV } = require("./exporter");
const { saveSnapshot, getPreviousSnapshot } = require("./snapshot");
const { compareSnapshots } = require("./diff");
const { mergeLicenses } = require("./license");
const { generateAllReports } = require("./reporter");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
  quiet: true,
});

async function processClient(client) {
  const username = process.env[client.username_env];
  const password =
    process.env[client.password_env || client.application_password];

  try {
    if (!username || !password) {
      throw new Error("Missing username or password in .env");
    }

    const credentials = Buffer.from(`${username}:${password}`).toString(
      "base64",
    );
    const rawData = await getData(client.url, credentials);

    const normalized = normalizeClientData(client, rawData);
    normalized.plugins = mergeLicenses(normalized.plugins);

    const diff = compareSnapshots(
      normalized,
      getPreviousSnapshot(client.client_id),
    );
    saveSnapshot(normalized);
    saveNormalizedDataToCSV(normalized);
    return { normalized, diff };
  } catch (err) {
    console.error(`Failed to process ${client.client_id}: ${err.message}`);

    const failed = normalizeClientData(client, null, err.message);
    saveSnapshot(failed);
    saveNormalizedDataToCSV(failed);
    return { normalized: failed, diff: compareSnapshots(failed, null) };
  }
}

(async () => {
  const results = await Promise.all(clients.map(processClient));
  await generateAllReports(results);
})().catch((err) => {
  console.error(`Audit aborted: ${err.message}`);
  process.exit(1);
});
