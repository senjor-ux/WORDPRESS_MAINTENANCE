const fs = require("fs");
const path = require("path");

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((val) => val.replace(/^"|"$/g, ""));
}

function loadLicenseRegister() {
  const csvPath = path.join(__dirname, "../config/licenses.csv");
  if (!fs.existsSync(csvPath)) return new Map();

  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  if (lines.length <= 1) return new Map();

  const headers = parseCSVLine(lines[0]);
  const licenseMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, index) => {
      row[h] = values[index] || "";
    });

    // Unique composite key: site_id + plugin_identifier
    const key = `${row.site_id}:::${row.plugin_identifier}`;
    licenseMap.set(key, row);
  }

  return licenseMap;
}

function mergeLicenses(normalizedPlugins) {
  const licenseMap = loadLicenseRegister();

  return normalizedPlugins.map((plugin) => {
    const key = `${plugin.site_id}:::${plugin.plugin_identifier}`;
    const licenseInfo = licenseMap.get(key);

    return {
      ...plugin,
      license_status: licenseInfo ? licenseInfo.license_status : "unknown",
      expiry_date: licenseInfo ? licenseInfo.expiry_date : "unknown",
      vendor: licenseInfo ? licenseInfo.vendor : "unknown",
      owner: licenseInfo ? licenseInfo.owner : "unknown",
      verification_source: licenseInfo
        ? licenseInfo.verification_source
        : "unknown",
      verified_at: licenseInfo ? licenseInfo.verified_at : "unknown",
      notes: licenseInfo ? licenseInfo.notes : "",
    };
  });
}

module.exports = { mergeLicenses };
