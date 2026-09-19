// pages/user/finance/journalEntries/tableConfig.jsx
// Read-only columns -- sap_gl_journal_entries is a mirror of SAP, not
// editable here.

import { formatDate } from "../../../../functions/formatDate";

export const journalEntriesTableConfig = () => [
  {
    key: "posting_date",
    label: "Posting Date",
    getValue: (row) => formatDate(row.posting_date),
    editable: false,
  },
  {
    key: "memo",
    label: "Memo",
    getValue: (row) => row.memo,
    editable: false,
  },
  {
    key: "reference_1",
    label: "Reference",
    getValue: (row) => row.reference_1,
    editable: false,
  },
  {
    key: "trans_type",
    label: "Trans. Type",
    // "-3" is the one verified trans_type code in this codebase (SAP B1's
    // reserved period-end closing entry, per get_finance_dashboard_rpc.sql's
    // own comment) -- labeled for readability; every other code is shown
    // raw rather than guessed (see filterConfig.js's Entry Type filter for
    // the same scoping).
    getValue: (row) => (row.trans_type === "-3" ? "Closing Entry" : row.trans_type),
    editable: false,
  },
  {
    key: "total_debit_myr",
    label: "Total Debit (RM)",
    // Sourced from sap_gl_journal_entries_with_flags (see
    // finance_gl_entry_flags_view.sql) -- the same per-entry line-sum
    // already computed for the Unbalanced row flag, just also shown here
    // instead of only backing that badge.
    getValue: (row) =>
      row.total_debit_myr
        ? `RM ${Math.round(row.total_debit_myr).toLocaleString()}`
        : "",
    editable: false,
  },
  {
    key: "total_credit_myr",
    label: "Total Credit (RM)",
    getValue: (row) =>
      row.total_credit_myr
        ? `RM ${Math.round(row.total_credit_myr).toLocaleString()}`
        : "",
    editable: false,
  },
  {
    key: "due_date",
    label: "Due Date",
    getValue: (row) => formatDate(row.due_date),
    editable: false,
  },
];
