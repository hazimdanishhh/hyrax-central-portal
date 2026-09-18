import { supabase } from "../../../../../lib/supabaseClient";
import {
  fetchRepsByCode,
  fetchRepNamesByCode,
  attachRep,
} from "./salesOrdersService";
import {
  exclusiveUpperBound,
  toLocalDateString,
} from "../../../../../functions/dateRangeFilters";

// View-only filter keys -- every one of these reads a column produced by the
// lateral aggregates on sap_sales_orders_with_fulfillment, so it can't be
// evaluated against the raw sap_sales_orders table. Used below to decide
// whether the cheap raw-table count is valid for a given filter set.
const ENRICHED_FILTER_KEYS = [
  "leadMatchedOnly",
  "deliveryStatus",
  "deliveryOverdueOnly",
  "deliveryDueSoonOnly",
  "invoicedOnly",
  "fullyPaidOnly",
  "hasMismatchOnly",
];

// "false" is a labelled NO-OP on every "Only" toggle below (never an
// inversion), so it must read as INACTIVE here too.
function hasEnrichedFilter(filters = {}) {
  return ENRICHED_FILTER_KEYS.some((key) => {
    const v = filters[key];
    return v !== undefined && v !== "" && v !== "false";
  });
}

// Predicates whose columns exist on BOTH sap_sales_orders_with_fulfillment
// and the raw sap_sales_orders table -- safe to run against either, which is
// what lets the pagination count fall back to the cheap raw table below.
function applyBaseFilters(query, { search, filters }) {
  const FILTER_NULL = "__null__";
  let q = query;

  if (search) {
    const cleanSearch = search.trim();
    const isNumeric = /^\d+$/.test(cleanSearch);

    let orQuery = `customer_name.ilike.%${cleanSearch}%,customer_ref.ilike.%${cleanSearch}%`;

    if (isNumeric) {
      orQuery += `,so_number.eq.${cleanSearch}`;
    }

    q = q.or(orQuery);
  }

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "customerCode":
        if (value !== FILTER_NULL) q = q.eq("customer_code", value);
        break;

      case "salesRepCode":
        if (value !== FILTER_NULL) q = q.eq("sales_rep_code", value);
        break;

      case "statusCode":
        if (value !== FILTER_NULL) q = q.eq("status_code", value);
        break;

      case "isCancelled":
        if (value !== FILTER_NULL) q = q.eq("is_cancelled", value);
        break;

      case "startDate":
        q = q.gte("order_date", value);
        break;

      case "endDate":
        q = q.lt("order_date", exclusiveUpperBound(value));
        break;

      default:
        break;
    }
  });

  return q;
}

// The view-only predicates -- only ever run against
// sap_sales_orders_with_fulfillment, never against the raw table.
function applyEnrichedFilters(query, filters) {
  let q = query;

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      // Not a boolean "Only" toggle -- "partial" is only meaningful relative
      // to "fully delivered" (open_qty <= 0) vs. "not started" (delivered_qty
      // <= 0), so this is a real 4-way enum. Partial is deliberately
      // total_delivered_qty > 0 AND total_open_qty > 0 -- both sides
      // compared against zero, not against each other -- since open_qty is
      // the REMAINING undelivered quantity (RDR1.OpenQty), not the
      // originally ordered quantity, so "delivered < open" would wrongly
      // match a not-yet-started order too (delivered=0 is always < any
      // positive open_qty).
      case "deliveryStatus":
        if (value === "delivered") {
          q = q.eq("is_fully_delivered", true);
        } else if (value === "open") {
          q = q.eq("is_fully_delivered", false);
        } else if (value === "partial") {
          q = q.gt("total_delivered_qty", 0).gt("total_open_qty", 0);
        } else if (value === "not_started") {
          q = q.lte("total_delivered_qty", 0);
        }
        break;

      case "leadMatchedOnly":
        if (value === "true") q = q.eq("has_matched_lead", true);
        break;

      // Pairs with the Overdue Delivery KPI tile -- an open order (per
      // deliveryStatus's own is_fully_delivered signal) whose requested
      // delivery_date has already passed. toLocalDateString, not
      // exclusiveUpperBound: this is a lower-bound-style "< today"
      // comparison against a single day, not an inclusive range end.
      case "deliveryOverdueOnly":
        if (value === "true") {
          q = q
            .eq("is_fully_delivered", false)
            .lt("delivery_date", toLocalDateString(new Date()));
        }
        break;

      // The forward-looking counterpart -- open, undelivered, due within the
      // next 7 days. No tile sets this, so it's not an RPC param (see
      // get_fulfillment_overview_rpc.sql's own non-circularity rule).
      case "deliveryDueSoonOnly":
        if (value === "true") {
          q = q
            .eq("is_fully_delivered", false)
            .gte("delivery_date", toLocalDateString(new Date()))
            .lt(
              "delivery_date",
              exclusiveUpperBound(
                toLocalDateString(
                  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                ),
              ),
            );
        }
        break;

      case "invoicedOnly":
        if (value === "true") q = q.gt("matched_invoice_count", 0);
        else if (value === "none") q = q.eq("matched_invoice_count", 0);
        break;

      case "fullyPaidOnly":
        if (value === "true") q = q.eq("is_fully_paid", true);
        else if (value === "none") q = q.eq("is_fully_paid", false);
        break;

      case "hasMismatchOnly":
        if (value === "true") q = q.eq("has_paid_mismatch", true);
        break;

      default:
        break;
    }
  });

  return q;
}

/**
 * Read-only Sales Orders list, backed by sap_sales_orders_with_fulfillment
 * (see supabase/sql_editor/sap_sales_orders_with_fulfillment_view.sql) --
 * this view's per-order delivered/invoiced/paid rollups are what let this
 * page trace a Sales Order all the way through Delivered -> Invoiced ->
 * Fully Paid, rather than being a dead-end list of just the order itself.
 *
 * Pagination count is decoupled from the data fetch: when only base-column
 * filters are active (search/customer/rep/status/cancelled/date -- the
 * common, unfiltered-on-load case), the count comes from the cheap raw
 * sap_sales_orders table instead of the enriched view. This is valid because
 * every lateral in sap_sales_orders_with_fulfillment is an UNGROUPED
 * aggregate subquery (`left join lateral (...) on true`, no GROUP BY, no
 * fan-out join) -- row cardinality is provably identical to the base table,
 * and the view's own security_invoker = on means RLS parity holds too.
 * INVARIANT: if that view ever gains a GROUP BY lateral or a plain 1:N join,
 * this optimization must be reverted (go back to counting the view itself).
 * Only when an enrichment-derived filter (deliveryStatus/invoicedOnly/etc.)
 * is active does the count fall back to the expensive exact view count --
 * every one of those filters already narrows the result set, unlike the
 * unfiltered worst case this optimization targets.
 */
export async function fetchFulfillmentOrders({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const enriched = hasEnrichedFilter(filters);

  let dataQuery = supabase
    .from("sap_sales_orders_with_fulfillment")
    .select("*", enriched ? { count: "exact" } : {})
    .order(sortBy, { ascending: sortOrder === "ascending" });
  dataQuery = applyEnrichedFilters(
    applyBaseFilters(dataQuery, { search, filters }),
    filters,
  ).range(from, to);

  const countQuery = enriched
    ? null
    : applyBaseFilters(
        supabase
          .from("sap_sales_orders")
          .select("doc_entry", { count: "exact", head: true }),
        { search, filters },
      );

  const [dataRes, countRes, repsByCode, namesByCode] = await Promise.all([
    dataQuery,
    countQuery ?? Promise.resolve({ count: null, error: null }),
    fetchRepsByCode(),
    fetchRepNamesByCode(),
  ]);

  if (dataRes.error) throw dataRes.error;
  if (countRes.error) throw countRes.error;

  return {
    data: (dataRes.data || []).map((order) =>
      attachRep(order, repsByCode, namesByCode),
    ),
    totalCount: (enriched ? dataRes.count : countRes.count) || 0,
  };
}

/**
 * Fetch a single fulfillment-enriched order by its natural key (doc_entry),
 * for the deep-linkable /app/sales/orders/all/:docEntry detail route.
 */
export async function fetchFulfillmentOrderByDocEntry(docEntry) {
  if (!docEntry) return null;

  const [{ data, error }, repsByCode, namesByCode] = await Promise.all([
    supabase
      .from("sap_sales_orders_with_fulfillment")
      .select("*")
      .eq("doc_entry", Number(docEntry))
      .maybeSingle(),
    fetchRepsByCode(),
    fetchRepNamesByCode(),
  ]);

  if (error) throw error;
  if (!data) return null;

  return attachRep(data, repsByCode, namesByCode);
}

/**
 * KPI figures for the Sales Orders page's OverviewCards -- see
 * supabase/sql_editor/get_fulfillment_overview_rpc.sql. Takes the SAME
 * filters/search the paginated list already has, so the strip always
 * summarizes exactly the filtered slice below it. Mirrors
 * fetchInvoicesOverview.
 *
 * deliveryStatus/invoicedOnly/fullyPaidOnly/hasMismatchOnly/
 * deliveryOverdueOnly/deliveryDueSoonOnly are deliberately NOT forwarded --
 * they're what the tiles themselves set on the list when clicked, so feeding
 * them back would be circular (see the RPC's own header comment).
 */
export async function fetchFulfillmentOverview({ filters, search } = {}) {
  const FILTER_NULL = "__null__";

  const rpcParams = {
    p_customer_code: null,
    p_sales_rep_code: null,
    p_status_code: null,
    p_is_cancelled: null,
    p_lead_matched_only: null,
    p_start_date: null,
    p_end_date: null,
    p_search: search || null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "customerCode":
        rpcParams.p_customer_code = value === FILTER_NULL ? null : value;
        break;
      case "salesRepCode":
        rpcParams.p_sales_rep_code = value === FILTER_NULL ? null : value;
        break;
      case "statusCode":
        rpcParams.p_status_code = value === FILTER_NULL ? null : value;
        break;
      case "isCancelled":
        rpcParams.p_is_cancelled = value === FILTER_NULL ? null : value;
        break;
      // null (not false) when off, so it matches the list's own no-op "All".
      case "leadMatchedOnly":
        rpcParams.p_lead_matched_only = value === "true" ? true : null;
        break;
      case "startDate":
        rpcParams.p_start_date = value;
        break;
      case "endDate":
        rpcParams.p_end_date = value;
        break;
      default:
        break;
    }
  });

  const { data, error } = await supabase.rpc(
    "get_fulfillment_overview",
    rpcParams,
  );

  if (error) throw error;

  return data;
}
