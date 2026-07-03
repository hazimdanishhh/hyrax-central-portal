/**
 * Normalize form values before sending them to Supabase.
 *
 * Shared by every CRUD mutation service under src/features/** (previously this
 * exact function was duplicated in each one, and inlined 3× inside attendance).
 *
 * Rules:
 *  - `undefined` values are dropped (partial updates only touch provided fields).
 *  - Empty strings become `null` (so cleared inputs clear the column).
 *  - Foreign-key fields (`*_id`) are coerced: async-select `{ value }` objects
 *    unwrap to their value, and all-numeric strings become numbers.
 */
export function normalizeFields(rawFields) {
  return Object.fromEntries(
    Object.entries(rawFields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        // Empty string -> null
        if (value === "") return [key, null];

        // Foreign keys -> integer
        if (key.endsWith("_id") && value !== null) {
          // Async select object
          if (typeof value === "object" && value?.value) {
            return [key, value.value];
          }

          // Numeric string support
          const isNumeric = typeof value === "string" && /^\d+$/.test(value);

          return [key, isNumeric ? Number(value) : value];
        }

        return [key, value];
      }),
  );
}
