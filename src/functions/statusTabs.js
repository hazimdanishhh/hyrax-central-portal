// functions/statusTabs.js
//
// Generic status-tabs builder for list pages whose tabs branch on a single
// enum column (Projects' status, Tasks' status) -- unlike Sales Leads'
// bespoke, multi-dimensional stageTabsConfig (stage + on-hold + cancelled +
// active-pipeline flags), which stays hand-written since this helper
// wouldn't fit it.
//
// `to` is built by cloning the CURRENT searchParams and only touching the
// one status param (+ resetting page) -- this makes a tab click MERGE with
// whatever search/filters are already active (e.g. Projects' `category`
// filter, or typed search text) instead of replacing the whole query string
// the way Leads' own full-replace tabs do. Leads' tabs never needed to
// preserve anything else, so that shortcut was fine there; it would lose
// real state here.
const STATUSBOX_TO_PILL_THEME = {
  grey: "",
  blue: "blue",
  yellow: "yellow",
  green: "approval",
  red: "rejection",
};

export function buildStatusTabs({ searchParams, statuses, statusTypeMap = {}, paramKey = "status" }) {
  const currentValue = searchParams.get(paramKey) || "";

  const buildTo = (value) => {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    if (value) {
      params.set(paramKey, value);
    } else {
      params.delete(paramKey);
    }
    return `?${params.toString()}`;
  };

  return [
    { label: "All", to: buildTo(""), themeType: "", isActive: !currentValue },
    ...statuses.map((s) => ({
      label: s.label,
      to: buildTo(s.value),
      themeType: STATUSBOX_TO_PILL_THEME[statusTypeMap[s.value]] ?? "",
      isActive: currentValue === s.value,
    })),
  ];
}
