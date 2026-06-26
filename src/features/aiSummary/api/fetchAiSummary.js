import { supabase } from "../../../lib/supabaseClient";

/**
 * Fetch the AI summary matching the current date filters,
 * or the latest default summary if no filters are active.
 */
export async function fetchAiSummary(dashboardType, startDate, endDate) {
  if (!dashboardType) return null;

  let query = supabase
    .from("ai_dashboard_summaries")
    .select("*")
    .eq("dashboard_type", dashboardType);

  if (startDate && endDate) {
    query = query.eq("period_start", startDate).eq("period_end", endDate);
  } else {
    // If no dates, explicitly look for the all-time summary where dates are null
    query = query.is("period_start", null).is("period_end", null);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // 0 rows found
    throw error;
  }

  return normalizeSummary([data])[0];
}

/**
 * Normalize returned data
 */
function normalizeSummary(rows) {
  return rows.map((summary) => ({
    ...summary,
    created_at: formatDateTime(summary.created_at),
    period_start_formatted: formatDate(summary.period_start),
    period_end_formatted: formatDate(summary.period_end),
  }));
}

function formatDateTime(value) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-MY", {
    dateStyle: "medium",
  });
}
