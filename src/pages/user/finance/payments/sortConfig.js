export function getPaymentsSortConfig() {
  return [
    { label: "Payment Date", value: "payment_date" },
    { label: "Amount (RM)", value: "total_amount_myr" },
    { label: "Unallocated Amount (RM)", value: "unallocated_amount" },
  ];
}
