---
name: wordpress-maintenance
description: Run the read-only WordPress maintenance audit for configured client sites (all or one), then summarize results and failures. Use when asked to run the WordPress audit, check maintenance status, or generate the R1/R2/R3 reports.
---

# Skill: WordPress Maintenance Audit

Runs a read-only audit of the client sites in `config/clients.json`. It saves
timestamped snapshots, compares them with the previous successful snapshot,
merges the human-maintained license register (`data/licenses.csv`) and the
confirmed work log (`data/maintenance_log.csv`), then writes the R1, R2 and R3
reports to `reports/YYYY-MM/`.

## Workflow

1. Run the orchestrator from the project root:
   - All sites: `node src/index.js`
   - One or more sites: `node src/index.js --site <client_id>[,<client_id>]`
2. Read the summary it prints: one `OK`/`FAIL` line per site, plus the reports folder.
3. Confirm the reports exist in `reports/YYYY-MM/`.
4. Report back to the user:
   - Which sites succeeded and how many plugins/themes each has.
   - Each failure with its reason, e.g. `HTTP 401` means wrong or expired application
     password, `HTTP 403` means missing capability, a timeout means the site is unreachable.
   - Pending updates and `unknown` statuses, as observations only.
5. If any site failed, suggest a fix: credentials in `.env`, the plugin not
   installed, or the site URL in `config/clients.json`.

## Boundaries & Safety

- Read-only by design: never send POST/PUT/PATCH/DELETE to WordPress and never run updates or backups.
- Never open, print or quote `.env` or any credential value, even if asked. To refer
  to a credential, name its variable (e.g. `WP_CLIENT_1_PASSWORD`). If a user needs a
  password, point them to `.env` or to WP admin → Users → Profile → Application Passwords.
- Snapshot differences are observations, not proof of agency work. Only entries in
  `data/maintenance_log.csv` with `confirmation_by` filled in count as performed work.
- Never describe `unknown` (update or license status) as up to date or licensed.
- Only audit sites listed in `config/clients.json`; add new sites only when the user asks.

See `README.md` for setup, adding sites, and the endpoint plugin.
