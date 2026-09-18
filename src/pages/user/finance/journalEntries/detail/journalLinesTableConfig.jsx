// pages/user/finance/journalEntries/detail/journalLinesTableConfig.jsx
// Read-only columns for a journal entry's nested line items
// (sap_gl_journal_lines).

export const journalLinesTableConfig = () => [
  {
    key: "account_code",
    label: "Account Code",
    getValue: (row) => row.account_code,
    editable: false,
  },
  {
    key: "account_name",
    label: "Account Name",
    getValue: (row) => row.sap_gl_accounts?.account_name || row.account_code,
    editable: false,
  },
  {
    key: "debit_amount_myr",
    label: "Debit (RM)",
    getValue: (row) =>
      row.debit_amount_myr
        ? `RM ${Math.round(row.debit_amount_myr).toLocaleString()}`
        : "",
    editable: false,
  },
  {
    key: "credit_amount_myr",
    label: "Credit (RM)",
    getValue: (row) =>
      row.credit_amount_myr
        ? `RM ${Math.round(row.credit_amount_myr).toLocaleString()}`
        : "",
    editable: false,
  },
  {
    key: "bp_code",
    label: "Business Partner",
    // bp_name is resolved client-side against sap_customers (see
    // fetchJournalEntryLines.js) -- falls back to the raw code whenever it
    // doesn't resolve (no match, or no bp_code on this line at all).
    getValue: (row) => row.bp_name || row.bp_code || "",
    editable: false,
  },
];
