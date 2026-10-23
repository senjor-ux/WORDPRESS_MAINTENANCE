const fs = require("fs");
const path = require("path");

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result.map((val) => val.replace(/^"|"$/g, ""));
}

function loadMaintenanceLog(clientId) {
  const csvPath = path.join(__dirname, "../config/maintenance_log.csv");
  if (!fs.existsSync(csvPath)) return [];

  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]);
  const logs = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, index) => {
      row[h] = values[index] || "";
    });

    if (row.site_id === clientId) {
      logs.push(row);
    }
  }
  return logs;
}

module.exports = { loadMaintenanceLog };