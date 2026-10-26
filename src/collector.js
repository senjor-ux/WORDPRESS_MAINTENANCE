const https = require("https");
const axios = require("axios");

const agent = new https.Agent({ rejectUnauthorized: false });

async function getData(url, credentials) {
  try {
    const res = await axios.get(`${url}/wp-json/agency/v1/maintenance-status`, {
      headers: { Authorization: `Basic ${credentials}` },
      httpsAgent: agent,
      timeout: 15000,
    });

    if (typeof res.data !== "object") {
      throw new Error("Response is not JSON");
    }
    return res.data;
  } catch (err) {
    if (err.response)
      throw new Error(`HTTP Error. Status: ${err.response.status}`);
    if (err.code === "ECONNABORTED")
      throw new Error("Timed out after 15 seconds");
    throw new Error(err.code || err.message);
  }
}

module.exports = { getData };
