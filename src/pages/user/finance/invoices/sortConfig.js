export function getInvoicesSortConfig() {
  return [
    { label: "Invoice Date", value: "invoice_date" },
    { label: "Due Date", value: "due_date" },
    { label: "Amount (RM)", value: "total_amount_myr" },
  ];
}
