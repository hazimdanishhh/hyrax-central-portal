/**
 * Normalize form values before sending them to Supabase.
 *
 * Shared by every CRUD mutation service under src/features/** (previously this
 * exact function was duplicated in each one, and inlined 3× inside attendance).
 *
 * Rules:
 *  - `undefined` values are dropped (partial updates only touch provided fields).
 *  - Empty strings become `null` (so cleared inputs clear the column).
 *  - Async-select `{ value, label }` objects unwrap to their raw `value` --
 *    for ANY key, not just `*_id` foreign keys (added 2026-08 for
 *    `clients.sap_customer_code`, a text-typed SAP code using the same
 *    asyncSelect editor as every `*_id` picker, previously the only case
 *    this handled).
 *  - Foreign-key fields (`*_id`) additionally coerce all-numeric strings to
 *    numbers (SelectEditor already unwraps its own `{value}` before this
 *    function ever sees it, so this integer coercion only matters for
 *    async-select `*_id` fields).
 */
export function normalizeFields(rawFields) {
  return Object.fromEntries(
    Object.entries(rawFields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        // Empty string -> null
        if (value === "") return [key, null];

        // Async-select object, any key
        if (typeof value === "object" && value !== null && "value" in value) {
          return [key, value.value];
        }

        // Foreign keys -> integer
        if (key.endsWith("_id") && value !== null) {
          // Numeric string support
          const isNumeric = typeof value === "string" && /^\d+$/.test(value);

          return [key, isNumeric ? Number(value) : value];
        }

        return [key, value];
      }),
  );
}
