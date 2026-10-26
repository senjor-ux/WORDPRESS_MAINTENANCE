# WordPress Maintenance Skill

| Report | File | Audience |
|---|---|---|
| R1 consolidated | `reports/YYYY-MM/R1-summary-<date>.pdf` + `R1-consolidated-inventory-<date>.csv` | Internal |
| R2 per site | `reports/YYYY-MM/<site>-R2-internal-audit-<date>.pdf` | Internal |
| R3 client report | `reports/YYYY-MM/<site>-R3-client-report-<date>.pdf` | Client |

It never updates, backs up or writes anything on a WordPress site.

## Install

```sh
npm install
```

Then create `.env` and list your sites in
`config/clients.json` (see **Adding a site**).

## Install the endpoint plugin (each site)

The collector reads `GET /wp-json/agency/v1/maintenance-status`, provided by
the small plugin in `wordpress-plugin/wp-maintenance-endpoint/`.

1. Zip the `wp-maintenance-endpoint` folder (or copy it to
   `wp-content/plugins/`) and activate **wp-maintenance-endpoints** in WP admin.
2. The plugin creates a **Maintenance Auditor** role whose only extra
   capability is `view_maintenance_status`.
3. Create a dedicated user with that role (e.g. `maintenance-auditor`).
4. Logged in as that user: **Users → Profile → Application Passwords**, create
   one named "Maintenance Skill", and copy it into `.env`.

What the plugin does: lists all plugins and themes (active and inactive) and
reads WordPress's *cached* update data (`update_plugins`, `update_themes`,
`update_core` transients). It never triggers remote update checks and never logs
request headers. A plugin or theme that no update channel reports on, typically
a premium plugin with its own updater, is returned as `unknown`, never as
up to date.

### Required privileges

| Endpoint | Capability needed | Role |
|---|---|---|
| `agency/v1/maintenance-status` | `view_maintenance_status` (or `manage_options`) | Maintenance Auditor (least privilege) |
| `wp/v2/plugins` (fallback) | `activate_plugins` | Administrator |
| `wp/v2/themes` (fallback) | `switch_themes` (to list all themes, not just the active one) | Administrator |

If the agency endpoint is missing (HTTP 404), the collector falls back to the
core `wp/v2/plugins` and `wp/v2/themes` endpoints. These give the full inventory
but **no update data and no core version**, so those fields are reported as
`UNKNOWN`. The fallback only works for an administrator account, so install the
plugin and use the least-privilege role instead.

## Configuration

| File | Contents | In Git? |
|---|---|---|
| `config/clients.json` | Sites: `client_id`, `url` (https), `username_env`, `application_password`: names of env variables, never values | yes |
| `.env` | Usernames and application passwords | **never** |
| `data/licenses.csv` | Human-verified license register | yes |
| `data/maintenance_log.csv` | Human-confirmed work log | yes |

### Adding a site

1. Install the endpoint plugin and create the auditor user + application
   password on the site (above).
2. Add two lines to `.env`, e.g. `WP_CLIENT_4_USERNAME=…` and `WP_CLIENT_4_PASSWORD=…`.
3. Add an entry to `config/clients.json`:
   ```json
   { "client_id": "new-client", "url": "https://new-client.example",
     "username_env": "WP_CLIENT_4_USERNAME", "application_password": "WP_CLIENT_4_PASSWORD" }
   ```
   `client_id` is used in file names: letters, digits, `-` and `_` only.
4. Run it alone first: `node src/index.js --site new-client`.

### Managing credentials

- One application password per site, created for the dedicated auditor user.
- Store them only in `.env` (git-ignored), one `NAME=value` per line, using the
  variable names referenced in `config/clients.json`. They are read by the
  script directly, never printed, and never written to snapshots or reports.
- To rotate: create a new application password in WP, update `.env`, then
  revoke the old one. Revoke immediately if a password may have leaked.

Optional settings in `.env` (defaults shown):

```
WP_TIMEOUT_MS=15000
WP_RETRIES=2
WP_CONCURRENCY=2
# Local development only, see Security notes:
WP_ALLOW_INSECURE_LOCALHOST_TLS=true
```

### License register (`data/licenses.csv`)

```
site_id,plugin_identifier,license_status,expiry_date,vendor,owner,verification_source,verified_at,notes
```

Records are matched on `site_id` + `plugin_identifier` (the plugin file, e.g.
`elementor-pro/elementor-pro.php`, shown in R2 and the R1 CSV), never the
display name. `license_status` must be one of `active`, `expired`,
`not_required`, `unknown`, `to_verify`. Anything else, or a missing row, is
reported as `unknown`. The tool never infers a license from a plugin working or
updating.

### Maintenance log (`data/maintenance_log.csv`)

```
site_id,date,action,component,version_before_after,confirmation_by,confirmation_at,notes
```

(`version_before` and `version_after` as separate columns also work.)
An entry counts as **confirmed only when `confirmation_by` is filled in**. R3
shows only confirmed entries dated in the report month. `notes` stay internal
(R2 only). Snapshot differences are never shown to the client as work.

## Running

```sh
node src/index.js                        # all sites
node src/index.js --site acme-shop       # one site (repeat or comma-separate for more)
node src/index.js --concurrency 3        # default 2 sites at a time
```

Re-running on the same day overwrites that day's snapshot and reports. The diff
always compares against the latest *successful* snapshot from an earlier day.
`--site` collects only the named sites, but R1 still lists every configured
site using its latest snapshot.

Each site gets a 15 s timeout and up to 2 retries for network errors, HTTP 429
and 5xx. 401, 403 and 404 are not retried. A failing site is recorded as `error`
with a clear reason in R1 and R2, and it never stops the other sites.

## Output layout

```
snapshots/YYYY-MM-DD/<site>.json        normalized snapshot
snapshots/YYYY-MM-DD/<site>.raw.json    untouched API response (audit trail)
snapshots/YYYY-MM-DD/<site>-{site,plugins,themes}.csv
reports/YYYY-MM/…                       R1/R2/R3
```

`UNKNOWN` in any report means "could not be verified".

## Security notes

- Read-only: the collector only sends `GET` requests.
- HTTPS is required in `clients.json`, and TLS certificates are verified
  strictly. For local development only, `WP_ALLOW_INSECURE_LOCALHOST_TLS=true`
  accepts a self-signed or expired certificate on `localhost`, `127.0.0.1` and
  `[::1]`. It has no effect on other hosts. (`NODE_EXTRA_CA_CERTS` only works
  when set in the shell before Node starts; setting it in `.env` has no effect.)
- `reports/` and `snapshots/` are git-ignored. They contain client inventory and
  license data, so keep them access-restricted.
- Only add sites the agency is authorized to audit.
- R3 contains no credentials, license data, internal notes or other clients.