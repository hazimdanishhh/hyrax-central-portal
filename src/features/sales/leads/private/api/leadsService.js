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
 * KPI counts/values for the Leads LIST page's OverviewCards.
 * Source: get_leads_overview() (supabase/sql_editor/get_leads_overview_rpc.sql).
 *
 * Takes the SAME { filters, search } object fetchLeads() above takes, so the
 * strip always summarizes exactly the rows the list is showing. Every key in
 * the switch below has a matching branch in fetchLeads -- if you add a filter
 * there, add it here and to the RPC, or the two silently diverge.
 *
 * Booleans: filters arrive from the URL as the strings "true"/"false"
 * (usePaginatedQuery), so they're converted explicitly rather than relying on
 * PostgREST's text->boolean coercion.
 */
export async function fetchLeadsListOverview({ filters, search } = {}) {
  const FILTER_NULL = "__null__";

  const rpcParams = {
    p_owner_id: null,
    p_client_id: null,
    p_sap_customer_code: null,
    p_lead_source_type_id: null,
    p_lose_reason_id: null,
    p_product_type: null,
    p_stage: null,
    p_is_on_hold: null,
    p_is_cancelled: null,
    p_pending_sap_order: null,
    p_active_pipeline_only: null,
    p_lost_or_cancelled: null,
    p_closed_only: null,
    p_has_quotation: null,
    p_start_date: null,
    p_end_date: null,
    p_closed_date_from: null,
    p_closed_date_to: null,
    p_search: search || null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    // fetchLeads treats __null__ as "column IS NULL"; there's no RPC param
    // shape for that yet, so it degrades to "unfiltered" -- same compromise
    // fetchInvoicesOverview/fetchSalesOrdersOverview already make.
    const v = value === FILTER_NULL ? null : value;
    if (v === null) return;

    switch (key) {
      case "owner":
        rpcParams.p_owner_id = v;
        break;
      case "client":
        rpcParams.p_client_id = v;
        break;
      case "sapCustomer":
        rpcParams.p_sap_customer_code = v;
        break;
      case "leadSourceType":
        rpcParams.p_lead_source_type_id = v;
        break;
      case "loseReason":
        rpcParams.p_lose_reason_id = v;
        break;
      case "productType":
        rpcParams.p_product_type = v;
        break;
      case "stage":
        rpcParams.p_stage = v;
        break;

      case "onHold":
        rpcParams.p_is_on_hold = v === "true";
        break;
      case "cancelled":
        rpcParams.p_is_cancelled = v === "true";
        break;
      case "pendingSapOrder":
        rpcParams.p_pending_sap_order = v === "true";
        break;

      // Toggle-only filters -- fetchLeads applies these on "true" and
      // ignores every other value, so mirror that rather than sending false.
      case "activePipelineOnly":
        if (v === "true") rpcParams.p_active_pipeline_only = true;
        break;
      case "lostOrCancelled":
        if (v === "true") rpcParams.p_lost_or_cancelled = true;
        break;
      case "closedOnly":
        if (v === "true") rpcParams.p_closed_only = true;
        break;
      case "hasQuotation":
        if (v === "true") rpcParams.p_has_quotation = true;
        break;

      case "startDate":
        rpcParams.p_start_date = v;
        break;
      case "endDate":
        rpcParams.p_end_date = v;
        break;
      case "closedDateFrom":
        rpcParams.p_closed_date_from = v;
        break;
      case "closedDateTo":
        rpcParams.p_closed_date_to = v;
        break;

      default:
        break;
    }
  });

  const { data, error } = await supabase.rpc("get_leads_overview", rpcParams);

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
