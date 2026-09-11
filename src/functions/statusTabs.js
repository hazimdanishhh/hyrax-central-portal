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

// extraTabs (added 2026-09): computed-condition tabs mixed in alongside
// the raw-status ones -- e.g. Overdue/Due Soon/Completed Late, a
// due_date-derived bucket, not a value of the `status` column itself.
// Same idea as Sales Leads' own stageTabsConfig mixing stage tabs with
// boolean-flag tabs (ON HOLD/CANCELLED) in one strip, but built generically
// here instead of hand-written per page (see this file's own top comment
// for why Leads stays bespoke and this one doesn't need to be) -- each
// entry is `{ label, paramKey, value, type }`, where `type` reuses the
// same grey/blue/yellow/green/red vocabulary `statusTypeMap` values
// already use, translated through the same STATUSBOX_TO_PILL_THEME map.
//
// Selecting ANY tab -- raw-status or extra -- clears every OTHER tracked
// param first, so exactly one tab ever reads active at a time: clicking
// "Overdue" after "To Do" was selected drops `status` when it sets
// `dueStatus`, and vice versa. Untouched params (search, assignee,
// category, project, ...) are preserved exactly as buildTo already did.
export function buildStatusTabs({
  searchParams,
  statuses,
  statusTypeMap = {},
  paramKey = "status",
  extraTabs = [],
}) {
  const currentValue = searchParams.get(paramKey) || "";
  const trackedParamKeys = [paramKey, ...new Set(extraTabs.map((t) => t.paramKey))];

  const buildTo = (key, value) => {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    trackedParamKeys.forEach((k) => params.delete(k));
    if (value) {
      params.set(key, value);
    }
    return `?${params.toString()}`;
  };

  const isAnyExtraActive = extraTabs.some((t) => searchParams.get(t.paramKey) === t.value);

  const primaryTabs = [
    { label: "All", to: buildTo(paramKey, ""), themeType: "", isActive: !currentValue && !isAnyExtraActive },
    ...statuses.map((s) => ({
      label: s.label,
      to: buildTo(paramKey, s.value),
      themeType: STATUSBOX_TO_PILL_THEME[statusTypeMap[s.value]] ?? "",
      isActive: currentValue === s.value && !isAnyExtraActive,
    })),
  ];

  const secondaryTabs = extraTabs.map((t) => ({
    label: t.label,
    to: buildTo(t.paramKey, t.value),
    themeType: STATUSBOX_TO_PILL_THEME[t.type] ?? "",
    isActive: searchParams.get(t.paramKey) === t.value,
  }));

  return [...primaryTabs, ...secondaryTabs];
}
