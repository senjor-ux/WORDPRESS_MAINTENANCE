const fs = require("fs");
const path = require("path");

function convertToCSV(dataArray, headers) {
  if (!dataArray || dataArray.length === 0) return headers.join(",") + "\n";

  const rows = dataArray.map((obj) => {
    return headers
      .map((header) => {
        let value = obj[header];
        if (value === null || value === undefined) value = "";
        return `"${String(value).replace(/$"/g, '""')}"`;
      })
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function saveNormalizedDataToCSV(normalized) {
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const outputDir = path.join(__dirname, `../snapshots/${dateStr}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const clientId = normalized.site.client_id;

  const siteHeaders = [
    "client_id",
    "site_url",
    "checked_at",
    "fetch_status",
    "error",
    "installed_version",
    "available_core_update",
  ];
  fs.writeFileSync(
    path.join(outputDir, `${clientId}-site.csv`),
    convertToCSV([normalized.site], siteHeaders),
  );

  const pluginHeaders = [
    "site_id",
    "plugin_identifier",
    "name",
    "installed_version",
    "active",
    "update_available",
    "offered_version",
    "source",
  ];
  fs.writeFileSync(
    path.join(outputDir, `${clientId}-plugins.csv`),
    convertToCSV(normalized.plugins, pluginHeaders),
  );

  const themeHeaders = [
    "site_id",
    "theme_slug",
    "name",
    "installed_version",
    "active",
    "update_available",
    "offered_version",
  ];
  fs.writeFileSync(
    path.join(outputDir, `${clientId}-themes.csv`),
    convertToCSV(normalized.themes, themeHeaders),
  );
}

module.exports = { saveNormalizedDataToCSV };
