const path = require("path");
const { readCSVObjects } = require("./csv");

const allowedStatuses = [
  "active",
  "expired",
  "not_required",
  "unknown",
  "to_verify",
];

function cleanStatus(value) {
  let status = (value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (status === "verify" || status === "check") status = "to_verify";
  return allowedStatuses.includes(status) ? status : "unknown";
}

function loadLicenseRegister() {
  const rows = readCSVObjects(path.join(__dirname, "../data/licenses.csv"));
  const licenseMap = new Map();

  for (const row of rows) {
    licenseMap.set(`${row.site_id}:::${row.plugin_identifier}`, row);
  }
  return licenseMap;
}

function mergeLicenses(plugins) {
  const licenseMap = loadLicenseRegister();

  return plugins.map((plugin) => {
    const info =
      licenseMap.get(`${plugin.site_id}:::${plugin.plugin_identifier}`) || {};

    return {
      ...plugin,
      license_status: cleanStatus(info.license_status),
      expiry_date: info.expiry_date || "unknown",
      vendor: info.vendor || "unknown",
      owner: info.owner || "unknown",
      verification_source: info.verification_source || "unknown",
      verified_at: info.verified_at || "unknown",
      notes: info.notes || "",
    };
  });
}

module.exports = { mergeLicenses };
