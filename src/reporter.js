const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { toCSV } = require("./csv");
const { loadMaintenanceLog, versionChange } = require("./maintenance");
const { getLastSuccessfulCheck } = require("./snapshot");

const LEFT = 50;
const WIDTH = 512;
const BLUE = "#003366";
const RED = "#B00020";
const UNKNOWN_NOTE =
  "UNKNOWN = could not be verified automatically. It does not mean up-to-date or licensed.";

function updateText(item) {
  if (item.update_available === true) {
    return item.offered_version
      ? `Update to v${item.offered_version}`
      : "Update available";
  }
  if (item.update_available === false) return "Up-to-date";
  return "UNKNOWN";
}

function coreText(site) {
  const offered = site.available_core_update;
  if (offered === "none") return "Up-to-date";
  if (!offered || offered === "unknown") return "UNKNOWN";
  return `Update to v${offered}`;
}

function activeText(value) {
  if (value === true) return "Active";
  if (value === false) return "Inactive";
  return "UNKNOWN";
}

function show(value) {
  if (!value || value === "unknown") return "UNKNOWN";
  return String(value);
}

function formatDate(value) {
  if (!value || value === "unknown") return "never";
  return String(value).replace("T", " ").slice(0, 16);
}

function countUpdates(snapshot, state) {
  const items = [...snapshot.plugins, ...snapshot.themes];
  return items.filter((i) => i.update_available === state).length;
}

function createPdf(filePath) {
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const done = new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { doc, done };
}

function heading(doc, text, color = BLUE, size = 11) {
  if (doc.y > 670) doc.addPage();
  doc.moveDown(0.6);
  doc.fontSize(size).fillColor(color).text(text, LEFT, doc.y, { width: WIDTH });
  doc.moveDown(0.3);
}

function paragraph(doc, text, color = "black") {
  const clean = String(text).replace(/→/g, "->");
  doc.fontSize(9).fillColor(color).text(clean, LEFT, doc.y, { width: WIDTH });
}

function drawTable(doc, headers, rows, widths) {
  const totalWidth = widths.reduce((a, b) => a + b, 0);

  function drawRow(cells, y, isHeader) {
    let x = LEFT;
    cells.forEach((cell, i) => {
      const text =
        cell === null || cell === undefined
          ? ""
          : String(cell).replace(/→/g, "->");
      let color = "#212529";
      if (isHeader) color = "#FFFFFF";
      else if (text === "UNKNOWN") color = RED;

      doc.fontSize(8).fillColor(color);
      doc.text(text, x + 4, y + 4, {
        width: widths[i] - 8,
        height: 10,
        ellipsis: true,
        lineBreak: false,
      });
      x += widths[i];
    });
  }

  let y = doc.y;
  if (y > 700) {
    doc.addPage();
    y = 50;
  }

  doc.rect(LEFT, y, totalWidth, 18).fill(BLUE);
  drawRow(headers, y + 1, true);
  y += 18;

  rows.forEach((row, index) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
      doc.rect(LEFT, y, totalWidth, 18).fill(BLUE);
      drawRow(headers, y + 1, true);
      y += 18;
    }
    if (index % 2 === 0) doc.rect(LEFT, y, totalWidth, 16).fill("#F8F9FA");
    drawRow(row, y, false);
    y += 16;
  });

  doc.x = LEFT;
  doc.y = y + 6;
}

function writeR1(results, dir, stamp) {
  const csvRows = [];
  for (const { normalized } of results) {
    const site = normalized.site;
    const base = {
      site_id: site.client_id,
      site_url: site.site_url,
      fetch_status: site.fetch_status,
      checked_at: site.checked_at,
    };

    if (normalized.plugins.length === 0) {
      csvRows.push(base);
    }
    for (const p of normalized.plugins) {
      csvRows.push({
        ...base,
        plugin_identifier: p.plugin_identifier,
        name: p.name,
        installed_version: p.installed_version,
        offered_version: p.offered_version || "",
        active: p.active,
        update_available: p.update_available,
        license_status: p.license_status,
        expiry_date: p.expiry_date,
        vendor: p.vendor,
      });
    }
  }

  const csvHeaders = [
    "site_id",
    "site_url",
    "fetch_status",
    "checked_at",
    "plugin_identifier",
    "name",
    "installed_version",
    "offered_version",
    "active",
    "update_available",
    "license_status",
    "expiry_date",
    "vendor",
  ];
  const csvName = `R1-consolidated-inventory-${stamp}.csv`;
  fs.writeFileSync(path.join(dir, csvName), "﻿" + toCSV(csvRows, csvHeaders));

  const { doc, done } = createPdf(path.join(dir, `R1-summary-${stamp}.pdf`));

  doc
    .fontSize(18)
    .fillColor(BLUE)
    .text("Consolidated Internal Maintenance Report (R1)", { align: "center" });
  doc
    .fontSize(9)
    .fillColor("gray")
    .text(`Generated on: ${new Date().toISOString()}`, { align: "center" });

  const failed = results.filter(
    (r) => r.normalized.site.fetch_status !== "success",
  );

  heading(doc, "Sites");
  paragraph(
    doc,
    `${results.length} configured site(s): ${results.length - failed.length} collected successfully, ${failed.length} failed or partial.`,
  );
  doc.moveDown(0.5);

  const siteRows = results.map(({ normalized }) => {
    const site = normalized.site;
    const lastSuccess = formatDate(getLastSuccessfulCheck(site.client_id));

    if (site.fetch_status === "error") {
      return [
        site.client_id,
        "error",
        lastSuccess,
        "UNKNOWN",
        "UNKNOWN",
        "-",
        "-",
        "-",
        "-",
        "-",
      ];
    }

    const unknownLicenses = normalized.plugins.filter(
      (p) => p.license_status === "unknown",
    ).length;
    return [
      site.client_id,
      site.fetch_status,
      lastSuccess,
      show(site.installed_version),
      coreText(site),
      normalized.plugins.length,
      normalized.themes.length,
      countUpdates(normalized, true),
      countUpdates(normalized, "unknown"),
      unknownLicenses,
    ];
  });

  drawTable(
    doc,
    [
      "Site ID",
      "Status",
      "Last Success",
      "Core",
      "Core Update",
      "Plugins",
      "Themes",
      "Updates",
      "Unk. Upd.",
      "Unk. Lic.",
    ],
    siteRows,
    [72, 42, 74, 44, 74, 38, 38, 40, 45, 45],
  );

  if (failed.length > 0) {
    heading(doc, "Collection Errors", RED);
    drawTable(
      doc,
      ["Site ID", "URL", "Error"],
      failed.map((r) => [
        r.normalized.site.client_id,
        r.normalized.site.site_url,
        r.normalized.site.error,
      ]),
      [80, 170, 262],
    );
  }

  doc.moveDown(0.5);
  paragraph(doc, UNKNOWN_NOTE, "gray");
  paragraph(doc, `Full plugin inventory: ${csvName}`, "gray");
  doc.end();
  return done;
}

function writeR2(snapshot, diff, logs, dir, stamp, period) {
  const site = snapshot.site;
  const failed = site.fetch_status === "error";
  const { doc, done } = createPdf(
    path.join(dir, `${site.client_id}-R2-internal-audit-${stamp}.pdf`),
  );

  doc
    .fontSize(16)
    .fillColor(BLUE)
    .text(`Internal Technical Audit (R2): ${site.client_id}`);
  doc
    .fontSize(9)
    .fillColor("gray")
    .text(`URL: ${site.site_url} | Period: ${period}`);

  heading(doc, "Collection Status");
  drawTable(
    doc,
    ["Fetch Status", "Checked At", "Last Successful Check"],
    [
      [
        site.fetch_status,
        formatDate(site.checked_at),
        formatDate(getLastSuccessfulCheck(site.client_id)),
      ],
    ],
    [130, 170, 212],
  );
  if (site.fetch_status !== "success") {
    paragraph(doc, `Collection error: ${site.error}`, RED);
  }

  heading(doc, "WordPress Core");
  drawTable(
    doc,
    ["Installed", "Update Status", "Last Update Check"],
    [
      [
        show(site.installed_version),
        coreText(site),
        formatDate(site.core_last_check),
      ],
    ],
    [140, 180, 192],
  );

  heading(doc, "Complete Theme Inventory");
  if (snapshot.themes.length === 0) {
    paragraph(
      doc,
      failed ? "Not available: collection failed." : "No themes detected.",
    );
  } else {
    drawTable(
      doc,
      ["Theme Name", "Slug", "Installed", "State", "Update Status"],
      snapshot.themes.map((t) => [
        t.name,
        t.theme_slug,
        show(t.installed_version),
        activeText(t.active),
        updateText(t),
      ]),
      [150, 120, 70, 62, 110],
    );
  }

  heading(doc, "Complete Plugin Inventory");
  if (snapshot.plugins.length === 0) {
    paragraph(
      doc,
      failed ? "Not available: collection failed." : "No plugins detected.",
    );
  } else {
    drawTable(
      doc,
      [
        "Plugin Name",
        "Version",
        "State",
        "Update Status",
        "Update Source",
        "License",
      ],
      snapshot.plugins.map((p) => [
        p.name,
        show(p.installed_version),
        activeText(p.active),
        updateText(p),
        p.source,
        show(p.license_status),
      ]),
      [160, 55, 55, 100, 72, 70],
    );

    heading(doc, "License Register");
    drawTable(
      doc,
      [
        "Plugin",
        "Status",
        "Expiry",
        "Vendor",
        "Owner",
        "Verified (source / date)",
      ],
      snapshot.plugins.map((p) => [
        p.name,
        show(p.license_status),
        show(p.expiry_date),
        show(p.vendor),
        show(p.owner),
        p.verification_source === "unknown"
          ? "UNKNOWN"
          : `${p.verification_source} / ${p.verified_at}`,
      ]),
      [150, 62, 62, 70, 70, 98],
    );
  }

  heading(doc, "Detected Changes (Snapshot Observations)");
  paragraph(doc, "Observations only; not proof of agency action.", "gray");
  doc.moveDown(0.3);
  if (diff.status === "fetch_failed") {
    paragraph(doc, "Not compared: collection failed.");
  } else if (diff.status === "new_site") {
    paragraph(doc, "No earlier successful snapshot to compare against.");
  } else if (diff.changes.length === 0) {
    paragraph(doc, "No inventory changes observed between snapshots.");
  } else {
    drawTable(
      doc,
      ["Component", "Identifier", "Change", "From", "To"],
      diff.changes.map((c) => [
        c.component,
        c.identifier,
        c.action,
        c.from || "-",
        c.to || "-",
      ]),
      [70, 190, 92, 80, 80],
    );
  }

  const confirmed = logs.filter((l) => l.confirmed);
  const unconfirmed = logs.filter((l) => !l.confirmed);

  heading(doc, `Confirmed Maintenance Log Actions (${period})`);
  if (confirmed.length === 0) {
    paragraph(doc, "No confirmed maintenance work logged for this period.");
  } else {
    drawTable(
      doc,
      ["Date", "Action", "Component", "Version", "Confirmed By"],
      confirmed.map((l) => [
        l.date,
        l.action,
        l.component,
        versionChange(l) || "-",
        l.confirmation_by,
      ]),
      [65, 80, 170, 110, 87],
    );
  }

  if (unconfirmed.length > 0) {
    heading(doc, "Unconfirmed Log Entries (excluded from client report)", RED);
    drawTable(
      doc,
      ["Date", "Action", "Component", "Notes"],
      unconfirmed.map((l) => [l.date, l.action, l.component, l.notes || "-"]),
      [65, 80, 170, 197],
    );
  }

  doc.moveDown(0.5);
  paragraph(doc, UNKNOWN_NOTE, "gray");
  doc.end();
  return done;
}

function writeR3(snapshot, logs, dir, stamp, period) {
  const site = snapshot.site;
  const failed = site.fetch_status === "error";

  const work = logs
    .filter((l) => l.confirmed)
    .map((l) => [
      l.date,
      l.action.toUpperCase(),
      l.component,
      versionChange(l) || "-",
    ]);

  const pending = countUpdates(snapshot, true);
  const unknown = countUpdates(snapshot, "unknown");
  const coreUpdate = coreText(site).startsWith("Update");

  const findings = [];
  const nextSteps = [];

  if (failed) {
    findings.push(
      "Our automated status check could not reach your website during this period. We will follow up to restore monitoring.",
    );
    nextSteps.push(
      "Restore access for the automated status check and repeat the review.",
    );
  } else {
    if (site.fetch_status === "partial") {
      findings.push(
        "The automated status check returned incomplete data, so some components could not be checked.",
      );
    }
    if (coreUpdate) {
      findings.push(
        `A WordPress core update (v${site.available_core_update}) is available.`,
      );
    }
    if (pending > 0) {
      findings.push(
        `${pending} plugin or theme update(s) are available and awaiting scheduling.`,
      );
    }
    if (unknown > 0) {
      findings.push(
        `The update status of ${unknown} component(s) could not be verified automatically (for example, premium plugins with their own update service). These will be checked manually.`,
      );
    }
    if (findings.length === 0) {
      findings.push(
        "No outstanding updates or issues were found during the automated status check.",
      );
    }

    if (coreUpdate || pending > 0) {
      nextSteps.push(
        "Schedule the available updates, to be applied after a backup and followed by testing.",
      );
    }
    if (unknown > 0) {
      nextSteps.push(
        "Manually verify components whose update status could not be confirmed.",
      );
    }
  }
  nextSteps.push("Continue routine monitoring in the next period.");

  let summary = `This report covers ${period}. `;
  if (work.length > 0) {
    summary += `${work.length} maintenance task(s) were completed and confirmed by our team. `;
  } else {
    summary += "No maintenance work has been confirmed for this period. ";
  }
  summary +=
    "Findings from our automated status check are listed separately; they are observations, not completed work.";

  const { doc, done } = createPdf(
    path.join(dir, `${site.client_id}-R3-client-report-${stamp}.pdf`),
  );

  doc
    .fontSize(20)
    .fillColor(BLUE)
    .text("Website Maintenance Report", LEFT, 50, {
      width: WIDTH,
      align: "right",
    });
  doc
    .fontSize(9)
    .fillColor("gray")
    .text(`${site.site_url} | Period: ${period}`, {
      width: WIDTH,
      align: "right",
    });
  doc
    .moveTo(LEFT, doc.y + 8)
    .lineTo(LEFT + WIDTH, doc.y + 8)
    .strokeColor(BLUE)
    .stroke();
  doc.y += 12;

  heading(doc, "Summary", BLUE, 13);
  paragraph(doc, summary);

  heading(doc, "Maintenance Work Performed", BLUE, 13);
  if (work.length === 0) {
    paragraph(doc, "No maintenance work has been confirmed for this period.");
  } else {
    drawTable(
      doc,
      ["Date", "Task", "Component", "Version"],
      work,
      [80, 100, 202, 130],
    );
  }

  heading(doc, "Status Check Findings", BLUE, 13);
  paragraph(
    doc,
    "Observations from an automated check, not completed work.",
    "gray",
  );
  doc.moveDown(0.2);
  findings.forEach((f) => paragraph(doc, `•  ${f}`));

  heading(doc, "Next Steps & Recommendations", BLUE, 13);
  nextSteps.forEach((s) => paragraph(doc, `•  ${s}`));

  doc.end();
  return done;
}

async function generateAllReports(results) {
  const period = new Date().toISOString().slice(0, 7);
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = path.join(__dirname, `../reports/${period}`);
  fs.mkdirSync(dir, { recursive: true });

  const pdfs = [writeR1(results, dir, stamp)];

  for (const { normalized, diff } of results) {
    const logs = loadMaintenanceLog(normalized.site.client_id, period);
    pdfs.push(writeR2(normalized, diff, logs, dir, stamp, period));
    pdfs.push(writeR3(normalized, logs, dir, stamp, period));
  }

  await Promise.all(pdfs);
}

module.exports = { generateAllReports };
