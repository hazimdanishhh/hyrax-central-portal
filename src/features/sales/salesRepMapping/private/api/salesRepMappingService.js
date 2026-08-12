import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Sales Rep Mapping list -- employee_sales_rep_mapping is a small,
 * auto-populated outrigger table (one row per SAP sales rep, via the
 * auto_create_sales_rep_mapping trigger), so this fetches the full set and
 * paginates/searches/sorts in memory rather than relying on PostgREST
 * embedded-filter syntax for a table this size. employee_id is the only
 * editable field -- sales_rep_code/sap_sales_persons fields are
 * pipeline-owned, read-only. See DASHBOARD-ROADMAP.md §1.1.
 */
export async function fetchSalesRepMappings({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  let query = supabase
    .from("employee_sales_rep_mapping")
    .select(
      "*, sap_sales_person:sap_sales_persons!sales_rep_code(*), employee:employees!employee_id(*)",
    );

  // --- FILTERS (base-table column) ---
  if (filters?.unmapped === "true") {
    query = query.is("employee_id", null);
  }

  const { data, error } = await query;

  if (error) throw error;

  let rows = data || [];

  // --- FILTERS (joined sap_sales_persons column) ---
  if (filters?.isActive) {
    rows = rows.filter(
      (row) => row.sap_sales_person?.is_active === filters.isActive,
    );
  }

  // --- SEARCH ---
  if (search) {
    const term = search.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.sap_sales_person?.sales_rep_name?.toLowerCase().includes(term) ||
        String(row.sales_rep_code).includes(term) ||
        row.employee?.full_name?.toLowerCase().includes(term),
    );
  }

  // --- SORT ---
  const direction = sortOrder === "ascending" ? 1 : -1;
  rows.sort((a, b) => {
    const aValue =
      sortBy === "sales_rep_name"
        ? a.sap_sales_person?.sales_rep_name || ""
        : a[sortBy];
    const bValue =
      sortBy === "sales_rep_name"
        ? b.sap_sales_person?.sales_rep_name || ""
        : b[sortBy];

    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return 0;
  });

  // --- PAGINATE ---
  const totalCount = rows.length;
  const from = (page - 1) * pageSize;
  const paged = rows.slice(from, from + pageSize);

  return {
    data: paged,
    totalCount,
  };
}
