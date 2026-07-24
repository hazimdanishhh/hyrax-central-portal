// pages/user/sales/orders/tableConfig.jsx
// Read-only columns -- sap_sales_orders is a mirror of SAP, not editable here.

import { formatDate } from "../../../../functions/formatDate";

export const salesOrdersTableConfig = () => [
  {
    key: "so_number",
    label: "SO #",
    getValue: (row) => row.so_number,
    editable: false,
  },
  {
    key: "customer_name",
    label: "Customer",
    getValue: (row) => row.customer_name,
    editable: false,
  },
  {
    key: "order_date",
    label: "Order Date",
    getValue: (row) => formatDate(row.order_date),
    editable: false,
  },
  {
    key: "delivery_date",
    label: "Delivery Date",
    getValue: (row) => formatDate(row.delivery_date),
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
    key: "gross_profit",
    label: "Gross Profit (RM)",
    editable: false,
    // Same master-data-defect guard get_finance_dashboard_rpc.sql applies
    // server-side (nulls out gross_profit where the magnitude is implausible
    // relative to order value) -- reimplemented here since this plain list
    // isn't routed through that RPC.
    getValue: (row) => {
      const gp = row.gross_profit;
      const total = row.total_amount_myr || 0;
      if (gp == null || Math.abs(gp) > Math.abs(total) * 5) return "—";
      return `RM ${Math.round(gp).toLocaleString()}`;
    },
  },
  {
    key: "customer_ref",
    label: "Customer PO #",
    getValue: (row) => row.customer_ref || "—",
    editable: false,
  },
];
