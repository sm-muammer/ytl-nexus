// CSV for DAT-03. A cell that starts with a formula character would run as a
// formula when opened in a spreadsheet, so it gets a leading apostrophe, which
// spreadsheets show as text. Cells with commas, quotes or line breaks are
// quoted per RFC 4180.

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Header row from the column names, then one row per record, CRLF line ends. */
export function toCsv(
  columns: readonly string[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): string {
  const lines = [columns.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(row[c])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
