// No dropdown filters for v1 -- SearchFilterBar's built-in date range covers
// the whole KPI set. Add a warehouse filter here once OWHS is extracted
// (see hyrax-central-portal/docs/DEPARTMENT-DASHBOARD-BLUEPRINT.md §5.3).
export function getFilterConfig() {
  return [];
}
