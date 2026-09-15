/**
 * RHF's own `required` semantics, minus its boolean-false special case -- an
 * empty array (multi-select) or null/undefined/"" fails; a deliberate
 * `false` or `0` is a real, filled-in answer (e.g. a tri-state select like
 * employees.needs_it_asset: true/false/null, where only null/not-yet-decided
 * should ever fail required). Shared by DataForm, the row-level table editor,
 * and the completeness calculator so all three agree on what "filled" means.
 */
export function isFilled(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== "";
}
