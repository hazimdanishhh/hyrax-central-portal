import { supabase } from "../../../../../lib/supabaseClient";
import {
  fetchRepsByCode,
  fetchRepNamesByCode,
  attachRep,
} from "../../../orders/private/api/salesOrdersService";
import {
  exclusiveUpperBound,
  toLocalDateString,
} from "../../../../../functions/dateRangeFilters";

/**
 * Read-only Fulfillment Tracker list, backed by
 * sap_sales_orders_with_fulfillment (see
 * supabase/sql_editor/sap_sales_orders_with_fulfillment_view.sql) -- the
 * dedicated, permanent home for that view's per-order delivered/invoiced/
 * paid rollups, now that fetchSalesOrders (salesOrdersService.js) has been
 * reverted back to the raw sap_sales_orders table. This page is deliberately
 * the heavier one (same `count: "exact"` over a `left join lateral` view as
 * fetchInvoices/fetchBills already do against their own balance views) --
 * see this file's own view's header comment for why that's an accepted,
 * intentional cost here rather than something to route around.
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
  const FILTER_NULL = "__null__";

  let query = supabase
    .from("sap_sales_orders_with_fulfillment")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    const cleanSearch = search.trim();
    const isNumeric = /^\d+$/.test(cleanSearch);

    let orQuery = `customer_name.ilike.%${cleanSearch}%,customer_ref.ilike.%${cleanSearch}%`;

    if (isNumeric) {
      orQuery += `,so_number.eq.${cleanSearch}`;
    }

    query = query.or(orQuery);
  }

  // --- FILTERS ---
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "customerCode":
        if (value !== FILTER_NULL) query = query.eq("customer_code", value);
        break;

      case "salesRepCode":
        if (value !== FILTER_NULL) query = query.eq("sales_rep_code", value);
        break;

      case "statusCode":
        if (value !== FILTER_NULL) query = query.eq("status_code", value);
        break;

      case "isCancelled":
        if (value !== FILTER_NULL) query = query.eq("is_cancelled", value);
        break;

      case "leadMatchedOnly":
        if (value === "true") query = query.eq("has_matched_lead", true);
        break;

      // Not a boolean "Only" toggle -- "partial" is only meaningful relative
      // to "fully delivered" (open_qty <= 0) vs. "not started" (delivered_qty
      // <= 0), so this is a real 3-way enum. Partial is deliberately
      // total_delivered_qty > 0 AND total_open_qty > 0 -- both sides
      // compared against zero, not against each other -- since open_qty is
      // the REMAINING undelivered quantity (RDR1.OpenQty), not the
      // originally ordered quantity, so "delivered < open" would wrongly
      // match a not-yet-started order too (delivered=0 is always < any
      // positive open_qty).
      case "deliveryStatus":
        if (value === "delivered") {
          query = query.eq("is_fully_delivered", true);
        } else if (value === "open") {
          query = query.eq("is_fully_delivered", false);
        } else if (value === "partial") {
          query = query
            .gt("total_delivered_qty", 0)
            .gt("total_open_qty", 0);
        } else if (value === "not_started") {
          query = query.lte("total_delivered_qty", 0);
        }
        break;

      // Pairs with the Overdue Delivery KPI tile -- an open order (per
      // deliveryStatus's own is_fully_delivered signal) whose requested
      // delivery_date has already passed. toLocalDateString, not
      // exclusiveUpperBound: this is a lower-bound-style "< today" comparison
      // against a single day, not an inclusive range end.
      case "deliveryOverdueOnly":
        if (value === "true") {
          query = query
            .eq("is_fully_delivered", false)
            .lt("delivery_date", toLocalDateString(new Date()));
        }
        break;

      case "invoicedOnly":
        if (value === "true") query = query.gt("matched_invoice_count", 0);
        else if (value === "none") query = query.eq("matched_invoice_count", 0);
        break;

      case "fullyPaidOnly":
        if (value === "true") query = query.eq("is_fully_paid", true);
        else if (value === "none") query = query.eq("is_fully_paid", false);
        break;

      case "hasMismatchOnly":
        if (value === "true") query = query.eq("has_paid_mismatch", true);
        break;

      case "startDate":
        query = query.gte("order_date", value);
        break;

      case "endDate":
        query = query.lt("order_date", exclusiveUpperBound(value));
        break;

      default:
        break;
    }
  });

  // paginate LAST
  query = query.range(from, to);

  const [{ data, count, error }, repsByCode, namesByCode] = await Promise.all([
    query,
    fetchRepsByCode(),
    fetchRepNamesByCode(),
  ]);

  if (error) throw error;

  return {
    data: (data || []).map((order) =>
      attachRep(order, repsByCode, namesByCode),
    ),
    totalCount: count || 0,
  };
}

/**
 * Fetch a single fulfillment-enriched order by its natural key (doc_entry),
 * for the deep-linkable /app/sales/fulfillment/:docEntry detail route --
 * mirrors fetchSalesOrderByDocEntry's role for useSalesOrder.
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
 * KPI figures for the Fulfillment Tracker's OverviewCards -- see
 * supabase/sql_editor/get_fulfillment_overview_rpc.sql. Takes the SAME
 * filters/search the paginated list already has, so the strip always
 * summarizes exactly the filtered slice below it. Mirrors
 * fetchInvoicesOverview.
 *
 * deliveryStatus/invoicedOnly/fullyPaidOnly/hasMismatchOnly/
 * deliveryOverdueOnly are deliberately NOT forwarded -- they're what the
 * tiles themselves set on the list when clicked, so feeding them back would
 * be circular (see the RPC's own header comment).
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
