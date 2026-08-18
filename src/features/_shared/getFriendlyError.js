/**
 * Map a Supabase/Postgres error into a user-facing message.
 *
 * Previously each mutation hook carried its own copy of this switch — and four
 * of them were copy-pasted from the employees hook, so leads/clients/contacts
 * showed employee-worded messages ("An employee with this work email already
 * exists.") for completely unrelated tables.
 *
 * Callers pass their own entity label and constraint map so the wording is
 * always correct for the table being mutated:
 *
 *   getFriendlyError(err, {
 *     entity: "lead",
 *     constraints: { title: "A lead with this title already exists." },
 *   });
 *
 * @param {object} err - the thrown Supabase error ({ code, message }).
 * @param {object} [config]
 * @param {string} [config.entity="record"] - singular noun, e.g. "lead".
 *   Pluralized with a trailing "s" for the permission message.
 * @param {Record<string,string>} [config.constraints] - substring of the DB
 *   error message -> friendly message. First match wins.
 * @param {string} [config.duplicateMessage] - overrides the default
 *   "already exists" wording when no constraint matches a 23505 error.
 */
export function getFriendlyError(
  err,
  { entity = "record", constraints = {}, duplicateMessage } = {},
) {
  // Checked before the switch, not nested inside case "23505" -- a
  // constraint name can surface under any error code (e.g. a CHECK
  // constraint like projects_name_not_blank/projects_dates_sane raises
  // 23514, not 23505), and the caller-supplied `constraints` map is meant
  // to catch any of them by matching the constraint's own name in the raw
  // Postgres message, regardless of which SQLSTATE carried it.
  const message = err?.message || "";

  for (const [needle, friendly] of Object.entries(constraints)) {
    if (message.includes(needle)) return friendly;
  }

  switch (err?.code) {
    case "23505":
      return (
        duplicateMessage || `A ${entity} with this information already exists.`
      );

    case "23503":
      return "This record is linked to other data and cannot be changed or removed.";

    case "42501":
      return `Permission denied. You aren't authorized to modify ${entity}s.`;

    // PostgREST's "no rows returned" -- what `.update().select().single()`
    // throws when a write succeeds against zero rows because an RLS
    // policy's USING clause silently filtered the target row out, not
    // because the record doesn't exist. Same underlying cause as 42501,
    // just surfaced differently by PostgREST's single-row shorthand.
    case "PGRST116":
      return `This ${entity} couldn't be found, or you aren't authorized to modify it.`;

    default:
      return message || "Something went wrong.";
  }
}
