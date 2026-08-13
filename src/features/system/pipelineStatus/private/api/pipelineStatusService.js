import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Current state -- one row per pipeline (sap_pipeline_state is a plain
 * upsert, so this is always exactly the last SUCCESSFUL run's watermark;
 * a broken pipeline just shows a stale row here, not an explicit failure --
 * that's what pipeline_run_log/fetchPipelineRunLog below is for). Small,
 * fixed-size table (~23 rows) -- no pagination needed.
 */
export async function fetchPipelineCurrentState() {
  const { data, error } = await supabase
    .from("sap_pipeline_state")
    .select("*")
    .order("pipeline_name");

  if (error) throw error;

  return data || [];
}

/**
 * Run history -- append-only, one row per attempt, success or failure.
 * Server-side filtering and pagination, same recipe as every other list
 * page (usePaginatedQuery).
 */
export async function fetchPipelineRunLog({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("pipeline_run_log")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  if (search) {
    query = query.ilike("pipeline_name", `%${search}%`);
  }

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    if (key === "status") {
      query = query.eq("status", value);
    }
  });

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}

/**
 * Success rate / failure count over a recent window, for the stat tiles at
 * the top of the page. Three head-count queries rather than fetching full
 * rows -- cheap regardless of how large the log table grows.
 */
export async function fetchPipelineStats(windowDays = 7) {
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [total, success, failed] = await Promise.all([
    supabase
      .from("pipeline_run_log")
      .select("id", { count: "exact", head: true })
      .gte("run_at", since),
    supabase
      .from("pipeline_run_log")
      .select("id", { count: "exact", head: true })
      .gte("run_at", since)
      .eq("status", "success"),
    supabase
      .from("pipeline_run_log")
      .select("id", { count: "exact", head: true })
      .gte("run_at", since)
      .eq("status", "error"),
  ]);

  const totalCount = total.count || 0;
  const successCount = success.count || 0;
  const failedCount = failed.count || 0;

  return {
    windowDays,
    totalCount,
    successCount,
    failedCount,
    successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : null,
  };
}
