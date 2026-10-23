const path = require("path");
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

module.exports = { getData };