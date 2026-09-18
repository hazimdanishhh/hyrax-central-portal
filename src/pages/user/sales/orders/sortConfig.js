export function getSalesOrdersSortConfig() {
  return [
    { label: "Order Date", value: "order_date" },
    { label: "Delivery Date", value: "delivery_date" },
    { label: "Amount (RM)", value: "total_amount_myr" },
    { label: "Outstanding (RM)", value: "total_outstanding_myr" },
  ];
}
