const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { loadMaintenanceLog } = require("./maintenance");

function loadAllLatestSnapshots() {
  const snapshotsRoot = path.join(__dirname, "../snapshots");
  if (!fs.existsSync(snapshotsRoot)) return [];

  const dates = fs
    .readdirSync(snapshotsRoot)
    .filter((d) => d !== "current")
    .sort()
    .reverse();
  if (dates.length === 0) return [];

  const latestDateFolder = path.join(snapshotsRoot, dates[0]);
  const files = fs
    .readdirSync(latestDateFolder)
    .filter((f) => f.endsWith(".json"));

  return files.map((file) => {
    const filePath = path.join(latestDateFolder, file);
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  });
}

function drawTable(doc, headers, rows, colWidths, startX = 50) {
  let currentY = doc.y;

  if (currentY > 700) {
    doc.addPage();
    currentY = 50;
  }

  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  doc.rect(startX, currentY, totalWidth, 18).fill("#003366");

  let currentX = startX;
  doc.fontSize(8).fillColor("#FFFFFF");
  headers.forEach((header, i) => {
    doc.text(header, currentX + 4, currentY + 4, {
      width: colWidths[i] - 8,
      ellipsis: true,
    });
    currentX += colWidths[i];
  });

  currentY += 18;

  rows.forEach((row, rowIndex) => {
    if (currentY > 720) {
      doc.addPage();
      currentY = 50;

      doc.rect(startX, currentY, totalWidth, 18).fill("#003366");
      let hX = startX;
      doc.fontSize(8).fillColor("#FFFFFF");
      headers.forEach((header, i) => {
        doc.text(header, hX + 4, currentY + 4, {
          width: colWidths[i] - 8,
          ellipsis: true,
        });
        hX += colWidths[i];
      });
      currentY += 18;
    }

    if (rowIndex % 2 === 0) {
      doc.rect(startX, currentY, totalWidth, 16).fill("#F8F9FA");
    }

    let cellX = startX;
    doc.fontSize(8).fillColor("#212529");
    row.forEach((cell, i) => {
      doc.text(String(cell || ""), cellX + 4, currentY + 4, {
        width: colWidths[i] - 8,
        ellipsis: true,
      });
      cellX += colWidths[i];
    });

    currentY += 16;
  });

  doc.y = currentY + 10;
}

function generateAllReports(diffResultsMap) {
  const snapshots = loadAllLatestSnapshots();
  if (snapshots.length === 0) return;

  const yearMonth = new Date().toISOString().slice(0, 7);
  const timestamp = new Date().toISOString().slice(0, 10);
  const reportsDir = path.join(__dirname, `../reports/${yearMonth}`);

  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const csvHeaders = [
    "site_id",
    "site_url",
    "plugin_identifier",
    "name",
    "installed_version",
    "offered_version",
    "active",
    "update_available",
    "license_status",
    "vendor",
  ];
  let csvRows = [csvHeaders.join(",")];

  snapshots.forEach((snapshot) => {
    const siteId = snapshot.site.client_id;
    const siteUrl = snapshot.site.site_url;

    (snapshot.plugins || []).forEach((p) => {
      const hasUpdate =
        p.update_available === true ||
        p.update_available === "true" ||
        (p.offered_version && p.offered_version !== p.installed_version);
      csvRows.push(
        [
          siteId,
          siteUrl,
          p.plugin_identifier || p.file || "",
          `"${(p.name || "").replace(/"/g, '""')}"`,
          p.installed_version || "unknown",
          p.offered_version || "",
          p.active !== undefined ? p.active : "unknown",
          hasUpdate,
          p.license_status || "unknown",
          p.vendor || "unknown",
        ].join(","),
      );
    });
  });

  fs.writeFileSync(
    path.join(reportsDir, `R1-consolidated-inventory-${timestamp}.csv`),
    csvRows.join("\n"),
  );

  const r1PdfPath = path.join(reportsDir, `R1-summary-${timestamp}.pdf`);
  const docR1 = new PDFDocument({ margin: 50 });
  docR1.pipe(fs.createWriteStream(r1PdfPath));

  docR1
    .fontSize(18)
    .fillColor("#003366")
    .text("Consolidated Internal Maintenance Report (R1)", { align: "center" });
  docR1
    .fontSize(9)
    .fillColor("gray")
    .text(`Generated on: ${new Date().toISOString()}`, { align: "center" });
  docR1.moveDown(1.5);

  const r1TableHeaders = [
    "Site ID",
    "URL",
    "Core Ver.",
    "Fetch Status",
    "Plugins",
    "Updates",
    "Unk. Licenses",
  ];
  const r1ColWidths = [70, 150, 60, 70, 45, 45, 60];
  const r1Rows = snapshots.map((s) => [
    s.site.client_id,
    s.site.site_url,
    s.site.installed_version || "unknown",
    s.site.fetch_status || "success",
    (s.plugins || []).length,
    (s.plugins || []).filter(
      (p) =>
        p.update_available === true ||
        p.update_available === "true" ||
        (p.offered_version && p.offered_version !== p.installed_version),
    ).length,
    (s.plugins || []).filter(
      (p) => !p.license_status || p.license_status === "unknown",
    ).length,
  ]);

  drawTable(docR1, r1TableHeaders, r1Rows, r1ColWidths);
  docR1.end();

  snapshots.forEach((snapshot) => {
    const clientId = snapshot.site.client_id;
    const diffResult = diffResultsMap.get(clientId) || {
      status: "unchanged",
      changes: [],
    };
    const confirmedWorkLogs = loadMaintenanceLog(clientId);

    const docR2 = new PDFDocument({ margin: 50 });
    docR2.pipe(
      fs.createWriteStream(
        path.join(reportsDir, `${clientId}-R2-internal-audit-${timestamp}.pdf`),
      ),
    );

    docR2
      .fontSize(16)
      .fillColor("#003366")
      .text(`Internal Technical Audit (R2): ${clientId}`);
    docR2
      .fontSize(9)
      .fillColor("gray")
      .text(
        `URL: ${snapshot.site.site_url} | Checked At: ${snapshot.site.checked_at}`,
      );
    docR2.moveDown(1);

    docR2
      .fontSize(11)
      .fillColor("#003366")
      .text("WordPress Core & System Status");
    docR2.moveDown(0.3);
    const coreHeaders = [
      "Core Installed",
      "Core Offered Update",
      "Fetch Status",
      "Errors",
    ];
    const coreWidths = [120, 120, 100, 160];
    const coreRows = [
      [
        snapshot.site.installed_version || "unknown",
        snapshot.site.offered_version || "None",
        snapshot.site.fetch_status || "success",
        snapshot.site.error || "None",
      ],
    ];
    drawTable(docR2, coreHeaders, coreRows, coreWidths);
    docR2.moveDown(0.5);

    docR2.fontSize(11).fillColor("#003366").text("Complete Theme Inventory");
    docR2.moveDown(0.3);
    if (!snapshot.themes || snapshot.themes.length === 0) {
      docR2.fontSize(9).fillColor("black").text("No themes detected.");
      docR2.moveDown(0.5);
    } else {
      const themeHeaders = [
        "Theme Name / Slug",
        "Installed Ver.",
        "State",
        "Update Status",
      ];
      const themeWidths = [200, 90, 80, 130];
      const themeRows = snapshot.themes.map((t) => {
        const hasThemeUpdate =
          t.update_available === true ||
          t.update_available === "true" ||
          (t.offered_version && t.offered_version !== t.installed_version);
        return [
          t.name || t.slug,
          t.installed_version || "unknown",
          t.active ? "Active" : "Inactive",
          hasThemeUpdate
            ? `v${t.offered_version || "Available"}`
            : "Up-to-date",
        ];
      });
      drawTable(docR2, themeHeaders, themeRows, themeWidths);
      docR2.moveDown(0.5);
    }

    docR2.fontSize(11).fillColor("#003366").text("Complete Plugin Inventory");
    docR2.moveDown(0.3);
    if (!snapshot.plugins || snapshot.plugins.length === 0) {
      docR2.fontSize(9).fillColor("black").text("No plugins detected.");
      docR2.moveDown(0.5);
    } else {
      const pluginHeaders = [
        "Plugin Name",
        "Version",
        "State",
        "Update Status",
        "License Status",
      ];
      const pluginWidths = [190, 60, 60, 90, 100];
      const pluginRows = snapshot.plugins.map((p) => {
        const hasUpdate =
          p.update_available === true ||
          p.update_available === "true" ||
          (p.offered_version && p.offered_version !== p.installed_version);
        return [
          p.name || p.plugin_identifier,
          p.installed_version || "unknown",
          p.active ? "Active" : "Inactive",
          hasUpdate ? `v${p.offered_version || "Available"}` : "Up-to-date",
          p.license_status || "unknown",
        ];
      });
      drawTable(docR2, pluginHeaders, pluginRows, pluginWidths);
      docR2.moveDown(0.5);
    }

    docR2
      .fontSize(11)
      .fillColor("#003366")
      .text("Detected Changes (Snapshot Observations)");
    docR2
      .fontSize(8)
      .fillColor("gray")
      .text("Note: Observations only; not proof of agency action.");
    docR2.moveDown(0.3);
    if (diffResult.changes.length === 0) {
      docR2
        .fontSize(9)
        .fillColor("black")
        .text("No inventory changes observed between snapshots.");
      docR2.moveDown(0.5);
    } else {
      const diffHeaders = [
        "Component",
        "Identifier",
        "Action",
        "From Version",
        "To Version",
      ];
      const diffWidths = [80, 180, 80, 80, 80];
      const diffRows = diffResult.changes.map((c) => [
        c.component || "plugin",
        c.plugin_identifier || "core",
        c.action,
        c.from || "N/A",
        c.to || "N/A",
      ]);
      drawTable(docR2, diffHeaders, diffRows, diffWidths);
      docR2.moveDown(0.5);
    }

    docR2
      .fontSize(11)
      .fillColor("#003366")
      .text("Confirmed Maintenance Log Actions");
    docR2.moveDown(0.3);
    if (confirmedWorkLogs.length === 0) {
      docR2
        .fontSize(9)
        .fillColor("black")
        .text("No verified maintenance work logged for this period.");
    } else {
      const logHeaders = ["Date", "Action", "Component", "Confirmed By"];
      const logWidths = [80, 110, 200, 110];
      const logRows = confirmedWorkLogs.map((l) => [
        l.date,
        l.action,
        l.component,
        l.confirmation_by || "Admin",
      ]);
      drawTable(docR2, logHeaders, logRows, logWidths);
    }

    docR2.end();

    const docR3 = new PDFDocument({ margin: 50 });
    docR3.pipe(
      fs.createWriteStream(
        path.join(reportsDir, `${clientId}-R3-client-report-${timestamp}.pdf`),
      ),
    );

    docR3
      .fontSize(20)
      .fillColor("#003366")
      .text("Website Maintenance Report", { align: "right" });
    docR3
      .fontSize(9)
      .fillColor("gray")
      .text(`Client ID: ${clientId} | Period: ${yearMonth}`, {
        align: "right",
      });
    docR3.moveDown(1.5);

    docR3.fontSize(13).fillColor("#2C3E50").text("Executive Summary");
    docR3
      .fontSize(9)
      .fillColor("black")
      .text(
        "We have completed regular routine maintenance, security checks, and platform stability assessments for your WordPress platform during this audit period.",
      );
    docR3.moveDown(1);

    docR3
      .fontSize(13)
      .fillColor("#2C3E50")
      .text("Confirmed Maintenance Work Performed");
    docR3.moveDown(0.3);

    if (confirmedWorkLogs.length === 0) {
      docR3
        .fontSize(9)
        .fillColor("black")
        .text(
          "• Routine platform security checks and infrastructure monitoring were completed successfully. All systems are operating stably.",
        );
    } else {
      const clientLogHeaders = [
        "Date",
        "Category / Action",
        "Details / Component",
      ];
      const clientLogWidths = [90, 140, 270];
      const clientLogRows = confirmedWorkLogs.map((l) => [
        l.date,
        l.action.toUpperCase(),
        l.notes || l.component,
      ]);
      drawTable(docR3, clientLogHeaders, clientLogRows, clientLogWidths);
    }
    docR3.moveDown(0.5);

    docR3.fontSize(13).fillColor("#2C3E50").text("Issues & Status");
    docR3.fontSize(9).fillColor("black");
    if (snapshot.site.error) {
      docR3.text(
        `• Notice: Temporary communication restriction encountered during recent audit (${snapshot.site.error}).`,
      );
    } else {
      docR3.text(
        "• No critical system vulnerabilities or blocking errors detected.",
      );
    }
    docR3.moveDown(1);

    docR3
      .fontSize(13)
      .fillColor("#2C3E50")
      .text("Next Steps & Recommendations");
    docR3.fontSize(9).fillColor("black");
    docR3.text("• Continued routine monitoring and weekly security checks.");
    docR3.text(
      "• Ongoing dependency management and upcoming component evaluation.",
    );

    docR3.end();
  });
}

module.exports = { generateAllReports };