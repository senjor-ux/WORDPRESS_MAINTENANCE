const fs = require("fs");

function parseCSV(content) {
  const text = content.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const result = [];
  for (const r of rows) {
    const values = r.map((v) => v.trim());
    if (values.some((v) => v !== "")) result.push(values);
  }
  return result;
}

function readCSVObjects(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const rows = parseCSV(fs.readFileSync(filePath, "utf8"));
  if (rows.length <= 1) return [];

  const headers = rows[0].map((h) => h.toLowerCase());
  const objects = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    headers.forEach((h, index) => {
      obj[h] = rows[i][index] || "";
    });
    objects.push(obj);
  }
  return objects;
}

function toCSV(rows, headers) {
  function escape(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

module.exports = { readCSVObjects, toCSV };
