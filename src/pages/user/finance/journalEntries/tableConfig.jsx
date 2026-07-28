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
    getValue: (row) => row.trans_type,
    editable: false,
  },
  {
    key: "due_date",
    label: "Due Date",
    getValue: (row) => formatDate(row.due_date),
    editable: false,
  },
];
