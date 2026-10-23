/**
 * Normalizes raw WordPress endpoint data into the exact inventory schema requirements.
 * @param {Object} client
 * @param {Object|null} rawData
 * @param {string|null} errorMessage
 */
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
      },
      plugins: [],
      themes: [],
    };
  }

  const site = {
    client_id: client.client_id,
    site_url: client.url,
    checked_at: rawData.site?.checked_at || new Date().toISOString(),
    fetch_status: "success",
    error: "none",
    installed_version: rawData.site?.installed_version || "unknown",
    available_core_update: rawData.site?.available_core_update || "unknown",
  };

  const plugins = (rawData.plugins || []).map((p) => ({
    site_id: client.client_id,
    plugin_identifier: p.plugin_identifier || p.file || "unknown",
    name: p.name || "Unknown Plugin",
    installed_version: p.installed_version || "0.0.0",
    active: p.active !== undefined ? Boolean(p.active) : "unknown",
    update_available:
      p.update_available !== undefined ? p.update_available : "unknown",
    offered_version: p.offered_version !== undefined ? p.offered_version : null,
    source: p.source || "repository",
  }));

  const themes = (rawData.themes || []).map((t) => ({
    site_id: client.client_id,
    theme_slug: t.theme_slug || t.slug || "unknown",
    name: t.name || "Unknown Theme",
    installed_version: t.installed_version || "0.0.0",
    active: t.active !== undefined ? Boolean(t.active) : "unknown",
    update_available:
      t.update_available !== undefined
        ? Boolean(t.update_available)
        : "unknown",
    offered_version: t.offered_version !== undefined ? t.offered_version : null,
  }));

  return { site, plugins, themes };
}

module.exports = { normalizeClientData };
