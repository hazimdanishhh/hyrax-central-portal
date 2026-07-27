// pages/user/finance/bills/detail/billLinesTableConfig.jsx
// Read-only columns for a bill's nested line items (sap_vendor_bill_lines).
//
// Future enhancement (not this pass): enrich with base_entry/base_type to
// show which goods receipt/purchase order each line traces back to.

export const billLinesTableConfig = () => [
  {
    key: "item_code",
    label: "Item Code",
    getValue: (row) => row.item_code,
    editable: false,
  },
  {
    key: "item_name",
    label: "Description",
    getValue: (row) => row.sap_items?.item_name || row.item_code,
    editable: false,
  },
  {
    key: "quantity",
    label: "Qty",
    getValue: (row) => row.quantity,
    editable: false,
  },
  {
    key: "unit_price",
    label: "Unit Price (RM)",
    getValue: (row) => `RM ${Math.round(row.unit_price || 0).toLocaleString()}`,
    editable: false,
  },
  {
    key: "line_total",
    label: "Line Total (RM)",
    getValue: (row) => `RM ${Math.round(row.line_total || 0).toLocaleString()}`,
    editable: false,
  },
];
