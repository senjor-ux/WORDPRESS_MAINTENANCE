# Skill: WordPress Maintenance Audit

## Description
Runs a read-only WordPress maintenance audit across configured client sites, generates JSON snapshots, compares diffs, incorporates local license registers and human-confirmed work logs, and exports R1, R2, and R3 reports.

## Trigger Instructions
When the user asks to run the WordPress audit, check maintenance status, or generate reports:
1. Execute the main Node.js orchestrator script: `node src/index.js`
2. Confirm completion by verifying that the reports have been generated in `reports/YYYY-MM/`.
3. Summarize any collection errors or warnings gracefully to the user.

## Boundaries & Safety
- Read-only by design (no POST/PUT/DELETE requests to WordPress)[cite: 5].
- Never expose API application passwords, secrets, or raw credentials in chat responses or reports[cite: 5].
- Treat snapshot differences as observations, not guaranteed agency updates[cite: 5].