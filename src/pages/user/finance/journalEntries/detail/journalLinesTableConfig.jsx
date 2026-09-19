// pages/user/finance/journalEntries/detail/journalLinesTableConfig.jsx
// Read-only columns for a journal entry's nested line items
// (sap_gl_journal_lines).

import { Link } from "react-router";

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
    // bp_name/bp_link_type are resolved client-side (see
    // fetchJournalEntryLines.js) -- bp_code isn't always a real business
    // partner (some are GL account codes), so this tries sap_customers
    // first, sap_gl_accounts second, and falls back to the raw code with no
    // link at all if neither matches.
    getValue: (row) => row.bp_name || row.bp_code || "",
    // " (Account)" suffix when it resolved as a GL account, not a business
    // partner -- per DASHBOARD-CONVENTIONS.md's source-labeling convention
    // ("never a generic word that could mean more than one thing"), so a
    // GL account never gets mistaken for an actual company in this column.
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
