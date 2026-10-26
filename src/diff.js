function compareList(component, key, currentItems, priorItems, changes) {
  const prior = new Map(priorItems.map((x) => [x[key], x]));
  const current = new Map(currentItems.map((x) => [x[key], x]));

  for (const [id, item] of current) {
    const prev = prior.get(id);

    if (!prev) {
      changes.push({
        component,
        identifier: id,
        action: "added",
        to: item.installed_version,
      });
      continue;
    }

    if (prev.installed_version !== item.installed_version) {
      changes.push({
        component,
        identifier: id,
        action: "version_changed",
        from: prev.installed_version,
        to: item.installed_version,
      });
    }

    if (prev.active !== item.active && typeof item.active === "boolean") {
      changes.push({
        component,
        identifier: id,
        action: item.active ? "activated" : "deactivated",
      });
    }
  }

  for (const [id, prev] of prior) {
    if (!current.has(id)) {
      changes.push({
        component,
        identifier: id,
        action: "removed",
        from: prev.installed_version,
      });
    }
  }
}

function compareSnapshots(current, prior) {
  if (current.site.fetch_status === "error")
    return { status: "fetch_failed", changes: [] };
  if (!prior) return { status: "new_site", changes: [] };

  const changes = [];

  if (current.site.installed_version !== prior.site.installed_version) {
    changes.push({
      component: "core",
      identifier: "wordpress",
      action: "version_changed",
      from: prior.site.installed_version,
      to: current.site.installed_version,
    });
  }

  compareList(
    "plugin",
    "plugin_identifier",
    current.plugins,
    prior.plugins || [],
    changes,
  );
  compareList(
    "theme",
    "theme_slug",
    current.themes,
    prior.themes || [],
    changes,
  );

  return { status: changes.length > 0 ? "modified" : "unchanged", changes };
}

module.exports = { compareSnapshots };
