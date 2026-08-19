// Pure parsing logic for CsvImportModal -- no React, independently testable.
// Deliberately thin: only a shape-level pre-check runs here (right column
// count, non-empty file). No per-field content validation and no dedup
// collapsing -- a naive client dedupe key would risk silently merging rows
// that are genuinely distinct on the server's fuller identity (e.g. two
// same-day half-day entries differing only in a field this config didn't
// think to include). All real validation happens server-side, via the
// config's runImport dry-run call.
import Papa from "papaparse";

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: "greedy",
      complete: (results) => resolve(results.data),
      error: (err) => reject(err),
    });
  });
}

/**
 * Maps raw Papa.parse rows (arrays of strings) into keyed row objects per
 * config.columns, using config.expectedColumnCount as a whole-file shape
 * gate: if ANY row's column count doesn't match, nothing is mapped and the
 * offending rows are returned as shapeErrors instead -- a column-count
 * anomaly means the file's overall shape assumption is broken (e.g. an
 * unescaped comma shifted every field after it on that line), so partial
 * mapping would silently produce misaligned data rather than a clear error.
 *
 * config: {
 *   expectedColumnCount: number,
 *   columns: [{ index, key, ignore }],  // ignore:true columns are dropped
 * }
 */
export function buildImportRows(rawRows, config) {
  if (!rawRows.length) {
    return { rows: [], shapeErrors: [], isEmpty: true };
  }

  const shapeErrors = [];
  rawRows.forEach((row, i) => {
    if (row.length !== config.expectedColumnCount) {
      shapeErrors.push({
        lineNumber: i + 1,
        columnCount: row.length,
        expected: config.expectedColumnCount,
        raw: row.join(", "),
      });
    }
  });

  if (shapeErrors.length > 0) {
    return { rows: [], shapeErrors, isEmpty: false };
  }

  const keyedColumns = config.columns.filter((c) => !c.ignore);

  const rows = rawRows.map((row) => {
    const obj = {};
    keyedColumns.forEach((col) => {
      obj[col.key] = (row[col.index] ?? "").trim();
    });
    return obj;
  });

  return { rows, shapeErrors: [], isEmpty: false };
}

export function buildPayload(rows, config) {
  return rows.map((row) => config.buildPayloadRow(row));
}
