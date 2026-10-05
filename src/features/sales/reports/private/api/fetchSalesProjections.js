// features/sales/reports/private/api/fetchSalesProjections.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Sales Projections
 * Source: get_sales_projections()
 *
 * A SECOND RPC on the Sales Reports page, deliberately separate from
 * get_sales_reports_dashboard. Two reasons, both from
 * docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md §9:
 *
 *   1. Different cadence. The dashboard moves whenever a filter changes; the
 *      projection only changes when a month closes. It gets its own query key
 *      and a much longer staleTime.
 *
 *   2. Independent failure. A projection outage must leave the rest of Sales
 *      Reports standing. Folding this into the page's shared isLoading/isError
 *      chain would take the whole page down with it.
 *
 * TAKES NO PARAMETERS, and that is not an oversight.
 *
 * The page carries a salesperson filter and a date range. Neither applies: the
 * projection is company-wide by design, because splitting an already-lumpy
 * series makes every sub-series lumpier (§"Permanently out of scope" -- the
 * top three invoices are 31.2% of a typical month).
 *
 * Passing the page's filters here would make the RPC ignore them silently,
 * which is worse than not passing them. The section's subtitle states it
 * instead, the same way existing FIXED-WINDOW charts say "not affected by the
 * date filter".
 */
export async function fetchSalesProjections() {
  const { data, error } = await supabase.rpc("get_sales_projections");

  if (error) throw error;

  return data;
}
