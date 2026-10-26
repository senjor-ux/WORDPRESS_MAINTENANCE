const fs = require("fs");
const path = require("path");
const { toCSV } = require("./csv");

const siteHeaders = [
  "client_id",
  "site_url",
  "checked_at",
  "fetch_status",
  "error",
  "installed_version",
  "available_core_update",
  "core_last_check",
];

const pluginHeaders = [
  "site_id",
  "plugin_identifier",
  "name",
  "installed_version",
  "active",
  "update_available",
  "offered_version",
  "source",
  "last_check",
];

const themeHeaders = [
  "site_id",
  "theme_slug",
  "name",
  "installed_version",
  "active",
  "update_available",
  "offered_version",
];

function saveNormalizedDataToCSV(normalized) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const outputDir = path.join(__dirname, `../snapshots/${dateStr}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const clientId = normalized.site.client_id;

  fs.writeFileSync(
    path.join(outputDir, `${clientId}-site.csv`),
    toCSV([normalized.site], siteHeaders),
  );
  fs.writeFileSync(
    path.join(outputDir, `${clientId}-plugins.csv`),
    toCSV(normalized.plugins, pluginHeaders),
  );
  fs.writeFileSync(
    path.join(outputDir, `${clientId}-themes.csv`),
    toCSV(normalized.themes, themeHeaders),
  );
}

module.exports = { saveNormalizedDataToCSV };
