// features/sales/leads/private/api/leads.js
import { supabase } from "../../../../../lib/supabaseClient";
import { formatDate, formatDateTime, formatTime } from "@/functions/formatDate";

// "2026-10-31" -> "2026-11-01" (pure date arithmetic, no timezone involved).
function nextDay(dateString) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

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
      sap_customer:sap_customers!sap_customer_code(customer_code, customer_name, city, contact_person, phone),
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

    // CREATED-DATE PERIOD (the page's period picker) -- whole days in
    // Malaysia time (2026-10-27), the same days as sales_lead_facts.created_on,
    // which the KPI cards (get_leads_overview) count by. Until now these
    // compared against naive timestamps (UTC days, and 23:59:59 dropped the
    // last second), so a lead created before 08:00 MYT fell in the wrong day.
    if (key === "startDate") {
      query = query.gte("created_at", `${value}T00:00:00+08:00`);
    }

    if (key === "endDate") {
      query = query.lt("created_at", `${nextDay(value)}T00:00:00+08:00`);
    }

    // AGING (the Aging 30+ Days card / tab): created on or before this date,
    // Malaysia time. Its own key, so it never fights the period's endDate.
    if (key === "createdBefore") {
      query = query.lt("created_at", `${nextDay(value)}T00:00:00+08:00`);
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

    // "closedOnly" -- WON+LOST, the Sales Reports Win Rate tile's own
    // denominator population (WON / (WON+LOST)).
    if (key === "closedOnly" && value === "true") {
      query = query.in("stage", ["WON", "LOST"]);
    }

    // "hasQuotation" -- backs quoteToWinConversionPct's denominator (leads
    // that had a quotation sent, regardless of outcome). Quotations has no
    // standalone entity/list of its own -- quotation_url is just a column on
    // sales_leads.
    if (key === "hasQuotation" && value === "true") {
      query = query.not("quotation_url", "is", null);
    }

    const map = {
      client: "client_id",
      sapCustomer: "sap_customer_code",
      owner: "lead_owner_id",
      stage: "stage",
      onHold: "is_on_hold",
      cancelled: "is_cancelled",
      leadSourceType: "lead_source_type_id",
      productType: "product_type",
      loseReason: "lose_reason_id",
      pendingSapOrder: "pending_sap_order",
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
 * KPI cards for the Leads LIST page (rebuilt 2026-10-27,
 * DASHBOARD-CONVENTIONS §2a). Source: get_leads_overview().
 *
 * The cards follow the list's period, panel filters and search -- the same
 * keys fetchLeads applies -- but NOT the status-tab keys (stage, onHold,
 * cancelled, activePipelineOnly, pendingSapOrder, lostOrCancelled,
 * closedOnly, createdBefore): each card IS one of those tabs, and its count
 * is what clicking it shows. If you add a panel filter to fetchLeads, add it
 * here and to the RPC too, or the cards and the list diverge.
 *
 * "__null__" (fetchLeads' "column IS NULL") has no RPC shape and degrades to
 * "unfiltered" here -- a known, rare gap.
 */
export async function fetchLeadsListOverview({ filters, search } = {}) {
  const FILTER_NULL = "__null__";
  const f = filters || {};
  const pick = (key) => {
    const v = f[key];
    return v === undefined || v === "" || v === FILTER_NULL ? null : v;
  };

  const { data, error } = await supabase.rpc("get_leads_overview", {
    p_owner_id: pick("owner"),
    p_client_id: pick("client"),
    p_sap_customer_code: pick("sapCustomer"),
    p_lead_source_type_id: pick("leadSourceType"),
    p_lose_reason_id: pick("loseReason"),
    p_product_type: pick("productType"),
    p_has_quotation: pick("hasQuotation") === "true" ? true : null,
    p_start_date: pick("startDate"),
    p_end_date: pick("endDate"),
    p_closed_date_from: pick("closedDateFrom"),
    p_closed_date_to: pick("closedDateTo"),
    p_search: search || null,
  });

  if (error) throw error;

  return data;
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
