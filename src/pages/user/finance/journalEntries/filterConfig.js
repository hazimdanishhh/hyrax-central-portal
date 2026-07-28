// Journal entries have no customer/vendor or open/closed status dimension
// the way Invoices/Bills do -- date range (handled by SearchFilterBar's own
// enableDateRange prop) plus the Fiscal Year filter bar are the only filters
// needed, so this config intentionally has no extra entries.
export function getJournalEntriesFilterConfig() {
  return [];
}
