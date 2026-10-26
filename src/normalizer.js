function trueFalseOrUnknown(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return "unknown";
}

function valueOrUnknown(value) {
  if (value === undefined || value === null || value === "") return "unknown";
  return String(value);
}

function getCoreUpdate(site) {
  if (!site) return "unknown";
  if (site.available_core_update) return site.available_core_update;
  if (site.update_available === true) return site.latest_version || "unknown";
  if (site.update_available === false) return "none";
  return "unknown";
}

function normalizeClientData(client, rawData, errorMessage = null) {
  if (errorMessage || !rawData) {
    return {
      site: {
        client_id: client.client_id,
        site_url: client.url,
        checked_at: new Date().toISOString(),
        fetch_status: "error",
        error: errorMessage || "Unknown fetch failure",
        installed_version: "unknown",
        available_core_update: "unknown",
        core_last_check: "unknown",
      },
      plugins: [],
      themes: [],
    };
  }

  const rawSite = rawData.site || {};
  const missing = [];
  if (!Array.isArray(rawData.plugins)) missing.push("plugins");
  if (!Array.isArray(rawData.themes)) missing.push("themes");

  const site = {
    client_id: client.client_id,
    site_url: client.url,
    checked_at: rawSite.checked_at || new Date().toISOString(),
    fetch_status: missing.length > 0 ? "partial" : "success",
    error:
      missing.length > 0 ? "Response missing: " + missing.join(", ") : "none",
    installed_version: valueOrUnknown(rawSite.installed_version),
    available_core_update: getCoreUpdate(rawData.site),
    core_last_check: valueOrUnknown(rawSite.core_last_check),
  };

  const plugins = (rawData.plugins || []).map((p) => ({
    site_id: client.client_id,
    plugin_identifier: p.plugin_identifier || p.file || "unknown",
    name: p.name || "Unknown Plugin",
    installed_version: valueOrUnknown(p.installed_version),
    active: trueFalseOrUnknown(p.active),
    update_available: trueFalseOrUnknown(p.update_available),
    offered_version: p.offered_version ?? null,
    source: p.source || "unknown",
    last_check: valueOrUnknown(p.last_check),
  }));

  const themes = (rawData.themes || []).map((t) => ({
    site_id: client.client_id,
    theme_slug: t.theme_slug || t.slug || "unknown",
    name: t.name || "Unknown Theme",
    installed_version: valueOrUnknown(t.installed_version),
    active: trueFalseOrUnknown(t.active),
    update_available: trueFalseOrUnknown(t.update_available),
    offered_version: t.offered_version ?? null,
  }));

  return { site, plugins, themes };
}

module.exports = { normalizeClientData };
