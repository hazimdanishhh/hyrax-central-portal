// pages/user/finance/bills/tableConfig.jsx
// Read-only columns -- sap_vendor_bills is a mirror of SAP, not editable here.

import { formatDate } from "../../../../functions/formatDate";

export const billsTableConfig = () => [
  {
    key: "bill_number",
    label: "Bill #",
    getValue: (row) => row.bill_number,
    editable: false,
  },
  {
    key: "vendor_name",
    label: "Vendor",
    getValue: (row) => row.vendor_name,
    editable: false,
  },
  {
    key: "bill_date",
    label: "Bill Date",
    getValue: (row) => formatDate(row.bill_date),
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
