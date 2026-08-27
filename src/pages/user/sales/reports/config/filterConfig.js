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
    {
      key: "productType",
      label: "Product Type",
      options: [
        { label: "TRANSFORMER OILS", value: "TRANSFORMER OILS" },
        { label: "LUBRICANTS", value: "LUBRICANTS" },
        { label: "MIXED", value: "MIXED" },
      ],
    },
  ];
}
