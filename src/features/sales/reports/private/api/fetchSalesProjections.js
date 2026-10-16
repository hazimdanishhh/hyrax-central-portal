// features/sales/reports/private/api/fetchSalesProjections.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Sales Projections — the whole Projections section of Sales Reports.
 * Source: get_sales_projections(p_fiscal_year_start)
 *
 * A SECOND RPC on this page, deliberately separate from
 * get_sales_reports_dashboard. Two reasons, both from
 * docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md §9:
 *
 *   1. Different cadence. The dashboard moves whenever a filter changes; the
 *      projection only changes when a month closes or the section's own year
 *      dropdown moves. It gets its own query key and a much longer staleTime.
 *
 *   2. Independent failure. A projection outage must leave the rest of Sales
 *      Reports standing. Folding this into the page's shared isLoading/isError
 *      chain would take the whole page down with it.
 *
 * ── IT ABSORBED get_sales_projection_accuracy (2026-10-16) ─────────────────
 *
 * There used to be two RPCs here. One took no arguments and always described
 * *now*; the other took a fiscal year. The section ran on two clocks — pick
 * FY 2024-2025 and three of four tiles carried on talking about next month.
 *
 * One function, one year, one answer. fetchSalesProjectionAccuracy.js is gone.
 *
 * ── THE ONE PARAMETER IS NOT THE PAGE'S DATE FILTER ────────────────────────
 *
 * `fiscalYearStart` is the Projections section's own dropdown, not the page's
 * date range, and there is still no salesperson parameter.
 *
 * The projection is company-wide by design, because splitting an already-lumpy
 * series makes every sub-series lumpier (§"Permanently out of scope" — the top
 * three invoices are 31.2% of a typical month). Passing the page's filters
 * here would make the RPC ignore them silently, which is worse than not
 * passing them. The section's subtitle states it instead, the same way
 * existing FIXED-WINDOW charts say "not affected by the date filter".
 *
 * `null` means "the fiscal year we are in", resolved server-side so the April
 * boundary is decided in exactly one place.
 */
export async function fetchSalesProjections({ fiscalYearStart } = {}) {
  const { data, error } = await supabase.rpc("get_sales_projections", {
    p_fiscal_year_start: fiscalYearStart ?? null,
  });

  if (error) throw error;

  return data;
}
