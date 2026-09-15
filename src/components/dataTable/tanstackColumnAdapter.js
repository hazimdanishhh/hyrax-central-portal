import { createColumnHelper } from "@tanstack/react-table";

const columnHelper = createColumnHelper();

/**
 * Translates this app's tableConfig.jsx column shape into minimal TanStack
 * ColumnDefs -- display-only (no accessor/cell), since DataTable/
 * DataTableCell/EditableTableRow still own actual cell rendering. TanStack
 * is used purely as the sort-state/header engine here (manualSorting +
 * manualPagination in DataTable.jsx), not to render or sort rows itself.
 *
 * `enableSorting` is opt-in per column (`col.sortable === true`, never
 * inferred) -- embedded/joined columns (e.g. employeesTableConfig.jsx's
 * `department`, `manager`) cannot be correctly sorted via a plain
 * `.order(key)` server-side (confirmed via @supabase/postgrest-js: a
 * `referencedTable` order only reorders the nested embedded array, never the
 * parent rows), so a page must deliberately mark a column sortable, ideally
 * with a `sortKey` override pointing at the real underlying column (e.g.
 * sort "Department" by `department_id`) when it wants that approximation.
 */
export function toTanstackColumns(columns) {
  return columns.map((col) =>
    columnHelper.display({
      id: col.sortKey || col.key,
      header: col.label,
      enableSorting: col.sortable === true,
      meta: { required: col.required === true },
    }),
  );
}
