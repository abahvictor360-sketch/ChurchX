import Papa from "papaparse";

/** Neutralises spreadsheet formula injection (=, +, -, @ at start of a cell). */
function safeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]) {
  return Papa.unparse({
    fields: columns.map((c) => c.label),
    data: rows.map((r) => columns.map((c) => safeCell(r[c.key]))),
  });
}

export function parseCsv(text: string) {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  });
  return { rows: result.data, errors: result.errors, fields: result.meta.fields ?? [] };
}

export function csvResponse(csv: string, filename: string) {
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
