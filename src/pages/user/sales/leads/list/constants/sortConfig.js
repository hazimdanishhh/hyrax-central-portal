// The Leads list's sort options (2026-10-27, DASHBOARD-CONVENTIONS §10).
// Default: Updated, newest first (usePaginatedQuery's defaultSortBy).
// "Owner" was dropped: it sorted by the owner's id, not their name -- the
// Salesperson filter answers "whose leads" instead.
export const getSortConfig = () => [
  { label: "Updated", value: "updated_at" },
  { label: "Created", value: "created_at" },
  { label: "Expected revenue", value: "expected_revenue" },
  { label: "Close probability", value: "close_probability" },
  { label: "Stage", value: "stage" },
];
