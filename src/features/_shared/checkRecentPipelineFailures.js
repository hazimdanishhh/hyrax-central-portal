import { supabase } from "../../lib/supabaseClient";

/**
 * Whether any of the given pipelines recorded a failed run recently.
 *
 * Reads `pipeline_run_log` (append-only, one row per attempt) rather than
 * `sap_pipeline_state.last_run_status` -- that column is hardcoded to the
 * literal string "success" at every call site across every SAP extractor,
 * and is never touched at all on a genuine failure, so it can never
 * actually reflect a failed run. `pipeline_run_log` is the real fix (see
 * hyrax-data-platform's CLAUDE.md, "Pipeline run logging added 2026-08").
 *
 * Shared by every dashboard's freshness banner ("Sync issue detected")
 * instead of each one repeating the same query.
 */
export async function hasRecentPipelineFailures(pipelineNames, windowHours = 48) {
  if (!pipelineNames?.length) return false;

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("pipeline_run_log")
    .select("id")
    .in("pipeline_name", pipelineNames)
    .eq("status", "error")
    .gte("run_at", since)
    .limit(1);

  if (error) throw error;

  return (data || []).length > 0;
}
