// pages/user/finance/payments/detail/paymentApplicationsTableConfig.jsx
// Read-only columns for a payment's nested application rows
// (sap_payment_applications). inv_entry/inv_type are shown raw rather than
// resolved to an invoice -- see fetchPaymentApplications.js's doc comment.
// The invoice FK is now CONFIRMED as doc_entry (filtered inv_type=13), not
// inv_entry -- inv_entry's true meaning is undetermined. This component
// still displays inv_entry/inv_type raw rather than a resolved invoice
// number/name; doing that properly is a small, now-unblocked follow-up
// (see DASHBOARD-ROADMAP.md), not done as part of this correction.

export const paymentApplicationsTableConfig = () => [
  {
    key: "applied_to",
    label: "Applied To",
    // inv_entry = 0 as "on-account, no specific invoice" is a plausible but
    // still-unconfirmed heuristic, unrelated to the now-confirmed doc_entry
    // FK above -- kept as-is pending the invoice-number-resolution follow-up.
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
