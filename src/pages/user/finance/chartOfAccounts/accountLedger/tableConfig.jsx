// pages/user/finance/chartOfAccounts/accountLedger/tableConfig.jsx
// Read-only columns -- sap_gl_journal_lines_with_entry_info is a mirror of
// SAP, not editable here. Deliberately no Account Code/Name column -- every
// row on this page is already scoped to the one account in the page header,
// unlike Journal Entries' own line-items table (journalLinesTableConfig.jsx)
// which spans every account in one entry, so that column is meaningful
// there but redundant here.

import { Link } from "react-router";
import { formatDate } from "../../../../../functions/formatDate";

export const accountLedgerTableConfig = () => [
  {
    key: "posting_date",
    label: "Posting Date",
    getValue: (row) => formatDate(row.posting_date),
    editable: false,
    sortable: true,
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
    key: "debit_amount_myr",
    label: "Debit (RM)",
    // This LINE's own amount -- not the parent entry's total (see
    // ChartOfAccounts.jsx's header comment for why that distinction is the
    // whole point of this page).
    getValue: (row) =>
      row.debit_amount_myr
        ? `RM ${Math.round(row.debit_amount_myr).toLocaleString()}`
        : "",
    editable: false,
    sortable: true,
  },
  {
    key: "credit_amount_myr",
    label: "Credit (RM)",
    getValue: (row) =>
      row.credit_amount_myr
        ? `RM ${Math.round(row.credit_amount_myr).toLocaleString()}`
        : "",
    editable: false,
    sortable: true,
  },
  {
    key: "bp_code",
    label: "Business Partner",
    // bp_name/bp_link_type resolved client-side -- see resolveBpNames.js
    // (shared with Journal Entries' own line-items table) for why a bp_code
    // isn't always a real business partner.
    getValue: (row) => row.bp_name || row.bp_code || "",
    render: (value, row) => {
      if (!row.bp_code) return <span>{value || "—"}</span>;

      if (row.bp_link_type === "business-partner") {
        return (
          <Link to={`/app/finance/business-partners/${row.bp_code}`}>
            {value}
          </Link>
        );
      }

      if (row.bp_link_type === "account") {
        return (
          <Link to={`/app/finance/chart-of-accounts?search=${row.bp_code}`}>
            {value} (Account)
          </Link>
        );
      }

      return <span>{value}</span>;
    },
    editable: false,
  },
];
