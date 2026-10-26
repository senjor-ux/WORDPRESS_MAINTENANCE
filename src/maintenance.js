const path = require("path");
const { readCSVObjects } = require("./csv");

function loadMaintenanceLog(clientId, period = null) {
  const rows = readCSVObjects(
    path.join(__dirname, "../data/maintenance_log.csv"),
  );
  const logs = [];

  for (const row of rows) {
    if (row.site_id !== clientId) continue;
    if (period && !(row.date || "").startsWith(period)) continue;
    logs.push({ ...row, confirmed: Boolean(row.confirmation_by) });
  }
  return logs;
}

function versionChange(entry) {
  if (entry.version_before_after) return entry.version_before_after;
  return [entry.version_before, entry.version_after]
    .filter(Boolean)
    .join(" → ");
}

module.exports = { loadMaintenanceLog, versionChange };
