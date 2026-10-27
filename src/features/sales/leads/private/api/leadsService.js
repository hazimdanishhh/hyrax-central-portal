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

  // Reads sales_leads_list (2026-10-27): sales_leads' own columns plus the
  // rule columns from sales_lead_facts -- outcome, created_on, closed_on,
  // pending_sap_order, won_myr -- the same definitions Leads Overview and
  // Sales Reports count with. Every filter below is a plain column test on
  // those; none re-derives a rule here (DASHBOARD-CONVENTIONS §10).
  // Mutations (leadsMutationsService.js) still write to sales_leads.
  let query = supabase
    .from("sales_leads_list")
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

    // CREATED-DATE PERIOD (the period picker) and AGING (createdBefore, the
    // Aging card / tab's own key): whole Malaysia days on created_on.
    if (key === "startDate") query = query.gte("created_on", value);
    if (key === "endDate") query = query.lte("created_on", value);
    if (key === "createdBefore") query = query.lte("created_on", value);

    // CLOSED WINDOW (Leads Overview / Reports drill-through links): whole
    // Malaysia days on closed_on, the same days those pages count by.
    if (key === "closedDateFrom") query = query.gte("closed_on", value);
    if (key === "closedDateTo") query = query.lte("closed_on", value);

    // OUTCOME: open | won | lost (cancelled is lost, D5) | closed (won or
    // lost -- the Win Rate links). Replaces the activePipelineOnly /
    // lostOrCancelled / closedOnly filters, which re-derived it from
    // stage + is_cancelled here.
    if (key === "outcome") {
      if (value === "closed") query = query.in("outcome", ["won", "lost"]);
      else query = query.eq("outcome", value);
    }

    // "hasQuotation" -- backs quoteToWinConversionPct's denominator (leads
    // that had a quotation sent, regardless of outcome).
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
 * keys fetchLeads applies -- but NOT the status-tab keys (outcome, stage,
 * onHold, cancelled, pendingSapOrder, createdBefore -- LEAD_TAB_KEYS): each
 * card IS one of those tabs, and its count
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
