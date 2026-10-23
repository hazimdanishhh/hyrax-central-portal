// ⚠ PARKED 2026-10-23 -- NOT DEPLOYED, NOT USED (see MeetingBrief.jsx).
// The table and edge function this calls do not exist in Supabase yet.
import { supabase } from "../../../../../lib/supabaseClient";

/**
 * The AI Meeting Brief for one period and salesperson (Sales Reports'
 * Summary tab, 2026-10-23), from public.sales_report_briefs -- whose RLS
 * lets a user read only briefs about figures the report would show them.
 * null when none has been generated yet.
 *
 * owner null = all salespeople -- except for a staff-role user, whom the
 * report always scopes to themselves: sales_report_scope (the report's own
 * rule) says whose brief to look up, exactly as the edge function stores it.
 */
export async function fetchMeetingBrief({ startDate, endDate, owner }) {
  if (!startDate || !endDate) return null;

  if (!owner) {
    const { data: scope, error: scopeError } = await supabase.rpc(
      "sales_report_scope",
      { p_owner_id: null },
    );
    if (scopeError) throw scopeError;
    owner = scope?.[0]?.owner_id ?? null;
  }

  let query = supabase
    .from("sales_report_briefs")
    .select("id, period_start, period_end, owner_id, brief_text, figures, model, created_at")
    .eq("period_start", startDate)
    .eq("period_end", endDate);
  query = owner ? query.eq("owner_id", owner) : query.is("owner_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Asks the edge function to write (or, if the last one is under 10 minutes
 * old, return) the brief. It runs with the caller's own session.
 */
export async function generateMeetingBrief({ startDate, endDate, owner }) {
  const { data, error } = await supabase.functions.invoke(
    "generate-sales-meeting-brief",
    { body: { startDate, endDate, owner: owner || null } },
  );
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
