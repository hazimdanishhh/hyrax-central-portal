// pages/user/finance/invoices/tableConfig.jsx
// Read-only columns -- sap_invoices is a mirror of SAP, not editable here.

import { formatDate } from "../../../../functions/formatDate";

export const invoicesTableConfig = () => [
  {
    key: "invoice_number",
    label: "Invoice #",
    getValue: (row) => row.invoice_number,
    editable: false,
  },
  {
    key: "customer_name",
    label: "Customer",
    getValue: (row) => row.customer_name,
    editable: false,
  },
  {
    key: "invoice_date",
    label: "Invoice Date",
    getValue: (row) => formatDate(row.invoice_date),
    editable: false,
  },
  {
    key: "due_date",
    label: "Due Date",
    getValue: (row) => formatDate(row.due_date),
    editable: false,
  },
  {
    key: "status_code",
    label: "Status",
    getValue: (row) => (row.status_code === "O" ? "Open" : "Closed"),
    editable: false,
  },
  {
    key: "total_amount_myr",
    label: "Total (RM)",
    getValue: (row) =>
      `RM ${Math.round(row.total_amount_myr || 0).toLocaleString()}`,
    editable: false,
  },
  {
    key: "outstanding",
    label: "Outstanding (RM)",
    getValue: (row) =>
      `RM ${Math.round((row.total_amount_myr || 0) - (row.paid_to_date || 0)).toLocaleString()}`,
    editable: false,
  },
];
