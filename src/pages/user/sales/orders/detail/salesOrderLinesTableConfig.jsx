// pages/user/sales/orders/detail/salesOrderLinesTableConfig.jsx
// Read-only columns for a sales order's nested line items
// (sap_sales_order_lines). delivered_qty/open_qty together show fulfilment
// progress -- the most useful thing this nested view adds beyond the
// order's own static header fields.

export const salesOrderLinesTableConfig = () => [
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
    label: "Qty Ordered",
    getValue: (row) => row.quantity,
    editable: false,
  },
  {
    key: "delivered_qty",
    label: "Delivered",
    getValue: (row) => row.delivered_qty,
    editable: false,
  },
  {
    key: "open_qty",
    label: "Open",
    getValue: (row) => row.open_qty,
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
