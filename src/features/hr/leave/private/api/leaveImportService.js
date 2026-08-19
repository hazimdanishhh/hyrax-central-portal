// Thin RPC wrapper -- all real parsing/validation/diff-sync logic lives
// server-side in sync_leave_ledger_from_snapshot
// (hyrax-central-portal/supabase/sql_editor/sync_leave_ledger_rpc.sql).
import { supabase } from "@/lib/supabaseClient";

export async function syncLeaveLedger({ rows, dryRun, allowShrink }) {
  const { data, error } = await supabase.rpc(
    "sync_leave_ledger_from_snapshot",
    {
      p_rows: rows,
      p_dry_run: dryRun,
      p_allow_shrink: allowShrink,
    },
  );

  if (error) throw error;

  return data;
}
