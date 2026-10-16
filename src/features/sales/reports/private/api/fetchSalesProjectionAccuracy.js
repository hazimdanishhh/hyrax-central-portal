// features/sales/reports/private/api/fetchSalesProjectionAccuracy.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Sales projection track record
 * Source: get_sales_projection_accuracy(p_fiscal_year_start)
 *
 * A THIRD RPC on the Sales Reports page, and deliberately separate from
 * get_sales_projections() rather than an extension of it.
 *
 * That function takes no arguments. Adding one would need an explicit
 * `drop function` -- `create or replace` cannot alter an argument list, and
 * the orphaned overload it leaves behind breaks PostgREST with PGRST203. A
 * second function leaves a working one alone.
 *
 * ── THE FISCAL YEAR IS A PARAMETER, NOT A PAGE FILTER ──────────────────────
 *
 * It is passed from local component state, not from the URL. Every URL param
 * on this page is swept into `filters` by useDashboardQuery and lands in the
 * Sales Reports query key -- so a fiscal year in the URL would refetch the
 * whole 1,638-line dashboard RPC every time the selector moved, and render an
 * unlabelled chip in ActiveFiltersBar.
 *
 * Null means "the fiscal year we are in", resolved server-side so the April
 * boundary is decided in one place.
 */
export async function fetchSalesProjectionAccuracy({ fiscalYearStart } = {}) {
  const { data, error } = await supabase.rpc("get_sales_projection_accuracy", {
    p_fiscal_year_start: fiscalYearStart ?? null,
  });

  if (error) throw error;

  return data;
}
