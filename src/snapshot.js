const fs = require("fs");
const path = require("path");

function saveSnapshot(normalized) {
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const snapshotDir = path.join(__dirname, `../snapshots/${dateStr}`);

  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const filePath = path.join(snapshotDir, `${normalized.site.client_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
}

function getPreviousSnapshot(clientId) {
  const snapshotsRoot = path.join(__dirname, "../snapshots");
  if (!fs.existsSync(snapshotsRoot)) return null;

  const dates = fs
    .readdirSync(snapshotsRoot)
    .filter((d) => d !== "current")
    .sort()
    .reverse();

  for (const dateFolder of dates) {
    const filePath = path.join(snapshotsRoot, dateFolder, `${clientId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (e) {
        // Skip corrupted files
      }
    }
  }
  return null;
}

function compareSnapshots(current, prior) {
  if (!prior) return { status: "new_site", changes: [] };

  const changes = [];

  if (current.site.installed_version !== prior.site.installed_version) {
    changes.push({
      component: "core",
      action: "version_changed",
      from: prior.site.installed_version,
      to: current.site.installed_version,
    });
  }

  const priorPlugins = new Map(
    prior.plugins.map((p) => [p.plugin_identifier, p]),
  );
  const currentPlugins = new Map(
    current.plugins.map((p) => [p.plugin_identifier, p]),
  );

  for (const [id, currPlugin] of currentPlugins) {
    const prevPlugin = priorPlugins.get(id);
    if (!prevPlugin) {
      changes.push({
        component: "plugin",
        plugin_identifier: id,
        action: "added",
      });
    } else {
      if (prevPlugin.installed_version !== currPlugin.installed_version) {
        changes.push({
          component: "plugin",
          plugin_identifier: id,
          action: "version_upgraded",
          from: prevPlugin.installed_version,
          to: currPlugin.installed_version,
        });
      }
    }
  }

  for (const [id] of priorPlugins) {
    if (!currentPlugins.has(id)) {
      changes.push({
        component: "plugin",
        plugin_identifier: id,
        action: "removed",
      });
    }
  }

  return { status: changes.length > 0 ? "modified" : "unchanged", changes };
}

module.exports = { saveSnapshot, getPreviousSnapshot, compareSnapshots };
