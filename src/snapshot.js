const fs = require("fs");
const path = require("path");

const snapshotsRoot = path.join(__dirname, "../snapshots");

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getSnapshotDates() {
  if (!fs.existsSync(snapshotsRoot)) return [];
  return fs.readdirSync(snapshotsRoot).sort().reverse();
}

function readSnapshot(date, clientId) {
  const filePath = path.join(snapshotsRoot, date, `${clientId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return null;
  }
}

function saveSnapshot(normalized) {
  const snapshotDir = path.join(snapshotsRoot, getToday());
  fs.mkdirSync(snapshotDir, { recursive: true });

  const filePath = path.join(snapshotDir, `${normalized.site.client_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
}

function getPreviousSnapshot(clientId) {
  const today = getToday();
  for (const date of getSnapshotDates()) {
    if (date >= today) continue;
    const snapshot = readSnapshot(date, clientId);
    if (snapshot && snapshot.site.fetch_status === "success") return snapshot;
  }
  return null;
}

function getLastSuccessfulCheck(clientId) {
  for (const date of getSnapshotDates()) {
    const snapshot = readSnapshot(date, clientId);
    if (snapshot && snapshot.site.fetch_status === "success")
      return snapshot.site.checked_at;
  }
  return null;
}

module.exports = { saveSnapshot, getPreviousSnapshot, getLastSuccessfulCheck };