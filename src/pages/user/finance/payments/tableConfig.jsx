// pages/user/finance/payments/tableConfig.jsx
// Read-only columns -- sap_payments is a mirror of SAP, not editable here.

import { formatDate } from "../../../../functions/formatDate";

export const paymentsTableConfig = () => [
  {
    key: "receipt_number",
    label: "Receipt #",
    getValue: (row) => row.receipt_number,
    editable: false,
  },
  {
    key: "customer_name",
    label: "Customer",
    getValue: (row) => row.customer_name,
    editable: false,
  },
  {
    key: "payment_date",
    label: "Payment Date",
    getValue: (row) => formatDate(row.payment_date),
    editable: false,
  },
  {
    key: "is_cancelled",
    label: "Status",
    getValue: (row) => (row.is_cancelled === "Y" ? "Cancelled" : "Active"),
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
    key: "unallocated_amount",
    label: "Unallocated (RM)",
    getValue: (row) =>
      `RM ${Math.round(row.unallocated_amount || 0).toLocaleString()}`,
    editable: false,
  },
  {
    key: "reference",
    label: "Reference",
    getValue: (row) => row.reference || "—",
    editable: false,
  },
];
