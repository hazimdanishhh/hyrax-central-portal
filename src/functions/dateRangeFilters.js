/**
 * Every sap_* date column in this app is stored as raw SAP-extracted text,
 * not a real date/timestamp type (see hyrax-data-platform/docs/
 * data-dictionary.md's "Text dates" note: "order_date, invoice_date,
 * payment_date, etc. are stored as text... Cast: order_date::date"), and
 * can carry a non-empty time-of-day suffix rather than a bare YYYY-MM-DD
 * value. PostgREST forbids casting a column inside a filter (`column::type`
 * is only supported in `select=`, not in a WHERE-clause filter), so a plain
 * `.lte(dateColumn, "2026-09-22")` string comparison silently EXCLUDES any
 * row whose stored text for that same calendar day carries a non-zero time
 * suffix -- a string with a suffix sorts as greater than its own prefix.
 *
 * The fix used everywhere in this app's date-range filters: never compare
 * an inclusive upper bound against a bare date string -- compare `< the
 * next calendar day` instead, which is unambiguously greater than any text
 * value for the intended day regardless of time-of-day suffix. Lower
 * bounds (`.gte()`) and already-exclusive upper bounds (`.lt()` against
 * "today", e.g. overdueOnly's own `due_date < today`) don't have this
 * problem and don't need this helper.
 */
export function exclusiveUpperBound(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}
