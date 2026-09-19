import {
  getSapCustomerByCode,
  searchSapCustomers,
  getSapGlAccountByCode,
  searchSapGlAccounts,
} from "../../../../features/finance/reports/private/api/financeMetadataService";

// Real filters (added 2026-09) -- date range (SearchFilterBar's own
// enableDateRange prop) plus the Fiscal Year filter bar remain the only
// period filters, since a journal entry has no customer/vendor or
// open/closed status dimension of its own the way Invoices/Bills do. These
// three close the "empty filterConfig" gap: Business Partner and Account
// Code were previously reachable only as URL-only reverse links (from a
// Business Partner card / Chart of Accounts' row click), never as page
// controls of their own; Entry Type is new.
export function getJournalEntriesFilterConfig() {
  return [
    {
      key: "bpCode",
      label: "Business Partner",
      editor: "asyncSelect",
      // sap_customers is SAP's own unified Business Partner master --
      // card_type C/L/S covers customers, leads, and vendors alike, so this
      // one search covers every bp_code a journal line could carry, no
      // customer-vs-vendor type detection needed (confirmed via
      // fetchJournalEntryLines.js's own bp_code resolution, which already
      // queries this same table with no card_type restriction).
      loadOptions: searchSapCustomers,
      getOptionByValue: getSapCustomerByCode,
      getDisplayValue: async (value) => {
        const option = await getSapCustomerByCode(value);
        return option?.label || value;
      },
    },
    {
      key: "accountCode",
      label: "Account Code",
      editor: "asyncSelect",
      loadOptions: searchSapGlAccounts,
      getOptionByValue: getSapGlAccountByCode,
      getDisplayValue: async (value) => {
        const option = await getSapGlAccountByCode(value);
        return option?.label || value;
      },
    },
    {
      key: "entryType",
      label: "Entry Type",
      // Only trans_type = "-3" is a verified code in this codebase (SAP
      // B1's reserved period-end closing entry, per
      // get_finance_dashboard_rpc.sql's own comment) -- scoped to exactly
      // that distinction rather than guessing labels for other trans_type
      // codes with no verified mapping anywhere in this repo.
      options: [
        { label: "Closing Entries Only", value: "closingOnly" },
        { label: "Exclude Closing Entries", value: "excludeClosing" },
      ],
    },
  ];
}

/**
 * Row-level exception flags (added 2026-09) -- same getRowFlags(row) => []
 * mechanism Payroll Export's own getRowReconciliationFlags already uses,
 * living in filterConfig.js for the same reason: it's the reconciliation-
 * rule half of this page's config, not a display column. Backed by real
 * columns on sap_gl_journal_entries_with_flags (see
 * finance_gl_entry_flags_view.sql) -- never re-derived here, so this badge
 * can never disagree with the view.
 */
export function getJournalEntryRowFlags(row) {
  const flags = [];

  if (row.is_unbalanced) {
    flags.push(
      "Unbalanced: this entry's mirrored debit/credit lines don't sum to zero — likely an incomplete sync for this transaction",
    );
  }

  if (row.has_nonpostable_posting) {
    flags.push(
      "Posts to a non-postable (summary/title) account — a data-integrity exception",
    );
  }

  return flags;
}
