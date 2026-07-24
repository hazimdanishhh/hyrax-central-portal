// pages/user/finance/payments/detail/paymentApplicationsTableConfig.jsx
// Read-only columns for a payment's nested application rows
// (sap_payment_applications). inv_entry/inv_type are shown raw rather than
// resolved to an invoice -- see fetchPaymentApplications.js's doc comment
// for why (the documented inv_entry -> sap_invoices.doc_entry join doesn't
// hold against live data; open question, not something to guess at here).

export const paymentApplicationsTableConfig = () => [
  {
    key: "applied_to",
    label: "Applied To",
    // inv_entry = 0 is documented (and plausible) as "on-account, no specific
    // invoice" -- that part doesn't depend on the disputed join, so it's
    // kept. Non-zero values are shown raw, not resolved to an invoice number.
    getValue: (row) =>
      row.inv_entry === 0 ? "On Account" : `Entry #${row.inv_entry}`,
    editable: false,
  },
  {
    key: "inv_type",
    label: "Type Code",
    getValue: (row) => row.inv_type,
    editable: false,
  },
  {
    key: "amount_applied_myr",
    label: "Amount Applied (RM)",
    getValue: (row) =>
      `RM ${Math.round(row.amount_applied_myr || 0).toLocaleString()}`,
    editable: false,
  },
];
