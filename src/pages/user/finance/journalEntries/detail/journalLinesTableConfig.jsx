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
    label: "BP Code",
    getValue: (row) => row.bp_code || "",
    editable: false,
  },
];
