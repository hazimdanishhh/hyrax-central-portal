/**
 * Resolves a column's raw value from a row via the getValue(fn/string) ->
 * accessor(fn/string) precedence chain -- previously duplicated across
 * DataTable, DataForm, and (implicitly) anything needing the same lookup.
 * One function, every column-driven consumer imports it.
 */
export function resolveColumnValue(row, col) {
  if (typeof col.getValue === "function") return col.getValue(row);
  if (typeof col.getValue === "string") return row?.[col.getValue];
  if (typeof col.accessor === "function") return col.accessor(row);
  if (typeof col.accessor === "string") return row?.[col.accessor];
  return null;
}

/**
 * Resolves a column's formatted display value, falling back to its raw
 * value when no display-specific accessor is configured.
 */
export function resolveDisplayValue(row, col, rawValue) {
  if (typeof col.displayValue === "function") return col.displayValue(row);
  if (typeof col.getDisplayValue === "function") return col.getDisplayValue(row);
  if (typeof col.displayAccessor === "function") return col.displayAccessor(row);
  return rawValue;
}
