import { supabase } from "../../../../../lib/supabaseClient";
import {
  fetchRepsByCode,
  fetchRepNamesByCode,
  attachRep,
} from "../../../orders/private/api/salesOrdersService";
import { exclusiveUpperBound } from "../../../../../functions/dateRangeFilters";

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
        } else if (value === "partial") {
          query = query
            .gt("total_delivered_qty", 0)
            .gt("total_open_qty", 0);
        } else if (value === "not_started") {
          query = query.lte("total_delivered_qty", 0);
        }
        break;

      case "invoicedOnly":
        if (value === "true") query = query.gt("matched_invoice_count", 0);
        break;

      case "fullyPaidOnly":
        if (value === "true") query = query.eq("is_fully_paid", true);
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
