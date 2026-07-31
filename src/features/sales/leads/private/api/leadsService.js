// features/sales/leads/private/api/leads.js
import { supabase } from "../../../../../lib/supabaseClient";
import { formatDate, formatDateTime, formatTime } from "@/functions/formatDate";

/**
 * Service to fetch Sales Leads for Sales department
 * Server-side filtering and pagination
 */
export async function fetchLeads({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
  isExport = false,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const FILTER_NULL = "__null__";

  // Reads through a view (not the sales_leads table directly) so closed_date
  // -- previously only computable inside get_sales_leads_dashboard_rpc.sql's
  // own query -- exists as a real, filterable column here too. Mutations
  // (leadsMutationsService.js) still write to sales_leads directly; this
  // view is additive and read-only.
  let query = supabase
    .from("sales_leads_with_closed_date")
    .select(
      `
      *,
      client:client_id(*),
      client_contact:client_contact_id(*),
      lead_owner:employees_public!lead_owner_id(*),
      lead_source_type:lead_source_type_id(*),
      lose_reason:lose_reason_id(*)
    `,
      { count: "exact" },
    )
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(`title.ilike.%${search}%`);
  }

  // --- FILTERS ---
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    // DATE RANGE FILTERS (created_at)
    if (key === "startDate") {
      query = query.gte("created_at", `${value}T00:00:00`);
    }

    if (key === "endDate") {
      query = query.lte("created_at", `${value}T23:59:59`);
    }

    // CLOSED-DATE RANGE (view-only column) -- mirrors the dashboard RPC's
    // own `closed_date <= p_end_date + interval '1 day'` upper bound exactly,
    // so a link built from a KPI's closed_date window returns the same rows.
    if (key === "closedDateFrom") {
      query = query.gte("closed_date", `${value}T00:00:00`);
    }

    if (key === "closedDateTo") {
      const nextDay = new Date(`${value}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      query = query.lte("closed_date", nextDay.toISOString());
    }

    // "activePipelineOnly" -- open, non-cancelled pipeline (stage not in
    // WON/LOST), mirrors activeLeads/activePipelineValue/
    // weightedPipelineValue's shared predicate exactly. Composable with the
    // existing onHold filter below to also back onHoldPipeline exactly
    // (stage not in WON/LOST + is_on_hold + not cancelled).
    if (key === "activePipelineOnly" && value === "true") {
      query = query.not("stage", "in", "(WON,LOST)").eq("is_cancelled", false);
    }

    // "lostOrCancelled" -- mirrors lostRevenue/lostLeads' own
    // (stage = 'LOST' OR is_cancelled) union exactly. stage and is_cancelled
    // are orthogonal columns (a lead can be cancelled from any stage), so no
    // single-column filter could express this before.
    if (key === "lostOrCancelled" && value === "true") {
      query = query.or("stage.eq.LOST,is_cancelled.eq.true");
    }

    const map = {
      client: "client_id",
      clientContact: "client_contact_id",
      owner: "lead_owner_id",
      stage: "stage",
      onHold: "is_on_hold",
      cancelled: "is_cancelled",
      leadSourceType: "lead_source_type_id",
      productType: "product_type",
      loseReason: "lose_reason_id",
    };

    const column = map[key];
    if (!column) return;

    // ✅ NULL filter (ONLY for real null)
    if (value === FILTER_NULL) {
      query = query.is(column, null);
      return;
    }

    query = query.eq(column, value);
  });

  // paginate LAST
  // 2. ONLY PAGINATE IF IT IS NOT AN EXPORT
  if (!isExport) {
    query = query.range(from, to);
  }

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: normalizeLeads(data || []),
    totalCount: count || 0,
  };
}

/**
 * Normalize returned data
 */
function normalizeLeads(rows) {
  return rows.map((activity) => ({
    ...activity,

    created_at: formatDateTime(activity.created_at),
    updated_at: formatDateTime(activity.updated_at),

    created_date: formatDate(activity.created_at),
    created_time: formatTime(activity.created_at),

    updated_date: formatDate(activity.updated_at),
    updated_time: formatTime(activity.updated_at),
  }));
}
