// Product Type removed (2026-10-01) -- p_product_type only ever filtered
// base_leads (CRM pipeline), with zero effect on any SAP-sourced KPI/chart
// on this page (confirmed structurally in get_sales_reports_dashboard_rpc.sql
// -- no other CTE references it). This page's one person-level filter is
// Salesperson; a product-level cut belongs on a page where it actually scopes
// everything, not just one CRM dimension. The RPC's own p_product_type
// parameter is left in place (always receives null from here on) rather than
// changing the function's signature -- see fetchSalesReportsDashboard.js.
export function getFilterConfig({ owners }) {
  return [
    {
      // Label is "Salesperson" (renamed 2026-08) -- this now scopes both
      // the CRM pipeline (sales_leads.lead_owner_id) AND every SAP-sourced
      // figure on the page (resolved server-side to sales_rep_code via
      // employee_sales_rep_mapping, see get_sales_reports_dashboard_rpc.sql)
      // -- "Owner" undersold what selecting a name here actually does.
      key: "owner",
      label: "Salesperson",
      options: owners.map((o) => ({ label: o.full_name, value: o.id })),
    },
  ];
}
