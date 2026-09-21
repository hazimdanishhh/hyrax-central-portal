/**
 * Decodes a Postgres `RAISE EXCEPTION ... USING detail = '<jsonb array>'::text`
 * as it reaches the client through PostgREST.
 *
 * Both bulk RPCs in this app use that protocol to report which specific rows
 * failed a whole-batch structural validation:
 *   - sync_leave_ledger_from_snapshot  (supabase/sql_editor/sync_leave_ledger_rpc.sql)
 *   - create_attendance_backfill       (supabase/sql_editor/create_attendance_backfill_rpc.sql)
 *
 * PostgREST surfaces the DETAIL field as `err.details`, a JSON *string*. It is
 * not guaranteed to be valid JSON -- a Postgres error raised from somewhere
 * else entirely (a constraint violation, a timeout) also populates `details`,
 * with prose -- so the parse always falls back to an empty list rather than
 * throwing a second error on top of the first.
 */
export function parseRpcErrorDetails(err, fallbackMessage = "Request failed.") {
  let details = [];

  if (err?.details) {
    try {
      const parsed = JSON.parse(err.details);
      details = Array.isArray(parsed) ? parsed : [];
    } catch {
      details = [];
    }
  }

  return { message: err?.message || fallbackMessage, details };
}
