// Single source of truth for the Leads CSV export -- shared by both Leads
// Overview and Leads List via CsvExportButton. Reconciles the field set that
// used to be hand-maintained separately inside the old ExportData.jsx
// (Stage/Actual Revenue/PO Number/Lose/Hold/Cancel Reason -- all still on the
// sales_leads data model but commented out of tableConfig.jsx, so they don't
// show up in the table UI) with tableConfig.jsx's own active fields that were
// missing from that old export (Description, Notes). Export-only
// reconciliation -- tableConfig.jsx itself is untouched.
export const leadsExportColumns = [
  { label: "Lead Title", accessor: (lead) => lead.title },
  { label: "Description", accessor: (lead) => lead.description || "" },
  {
    label: "Client",
    accessor: (lead) =>
      lead.client?.name || lead.sap_customer?.customer_name || "N/A",
  },
  { label: "Owner", accessor: (lead) => lead.lead_owner?.full_name || "Unassigned" },
  { label: "Product Type", accessor: (lead) => lead.product_type || "N/A" },
  { label: "Stage", accessor: (lead) => lead.stage },
  {
    label: "Close Probability (%)",
    accessor: (lead) => lead.close_probability || 0,
  },
  {
    label: "Expected Revenue (RM)",
    accessor: (lead) => lead.expected_revenue || 0,
  },
  { label: "Actual Revenue (RM)", accessor: (lead) => lead.actual_revenue || 0 },
  { label: "PO Number", accessor: (lead) => lead.po_number || "" },
  { label: "Source", accessor: (lead) => lead.lead_source_type?.name || "Unknown" },
  { label: "Notes", accessor: (lead) => lead.notes || "" },
  { label: "On Hold", accessor: (lead) => (lead.is_on_hold ? "Yes" : "No") },
  { label: "Hold Reason", accessor: (lead) => lead.hold_reason || "" },
  { label: "Cancelled", accessor: (lead) => (lead.is_cancelled ? "Yes" : "No") },
  { label: "Cancel Reason", accessor: (lead) => lead.cancel_reason || "" },
  { label: "Lose Reason", accessor: (lead) => lead.lose_reason?.name || "" },
  { label: "Created Date", accessor: (lead) => lead.created_date },
  { label: "Updated Date", accessor: (lead) => lead.updated_date },
];
