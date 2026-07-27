// pages/user/finance/vendorPayments/detail/vendorPaymentApplicationsTableConfig.jsx
// Read-only columns for a vendor payment's nested application rows
// (sap_vendor_payment_applications) -- AP mirror of
// paymentApplicationsTableConfig.jsx. inv_entry/doc_type are shown raw
// rather than resolved to a bill -- see fetchVendorPaymentApplications.js's
// doc comment.
// Note the column name difference from the AR side: sap_payment_applications
// calls this column inv_type, but here it's named doc_type (same meaning --
// SAP's polymorphic document-type code; 18 = OPCH vendor bill, 19 = ORPC A/P
// credit memo, other values not extracted).

export const vendorPaymentApplicationsTableConfig = () => [
  {
    key: "applied_to",
    label: "Applied To",
    // inv_entry = 0 as "on-account, no specific bill" is a plausible but
    // still-unconfirmed heuristic, mirroring the same caveat on the AR side.
    getValue: (row) =>
      row.inv_entry === 0 ? "On Account" : `Entry #${row.inv_entry}`,
    editable: false,
  },
  {
    key: "doc_type",
    label: "Type Code",
    getValue: (row) => row.doc_type,
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
