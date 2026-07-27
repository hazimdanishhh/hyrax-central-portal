// pages/user/finance/vendorPayments/tableConfig.jsx
// Read-only columns -- sap_vendor_payments is a mirror of SAP, not editable
// here.

import { formatDate } from "../../../../functions/formatDate";

export const vendorPaymentsTableConfig = () => [
  {
    key: "payment_number",
    label: "Payment #",
    getValue: (row) => row.payment_number,
    editable: false,
  },
  {
    key: "vendor_name",
    label: "Vendor",
    getValue: (row) => row.vendor_name,
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
