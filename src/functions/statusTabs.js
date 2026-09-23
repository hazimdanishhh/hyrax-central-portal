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
// for why Leads stays bespoke and this one doesn't need to be).
//
// Each entry accepts EITHER the original flat shape `{ label, paramKey,
// value, type }` (a single condition -- Overdue/Due Soon/etc. only ever
// need one) OR `{ label, type, conditions: [{paramKey, value}, ...] }`
// (multiple params set together as one tab). The multi-condition shape
// exists because a single raw flag is sometimes not actually what the
// tab means.
//
// Attendance used to be the motivating example: hr_flag='Absent' also fired
// for every ordinary unworked weekend, so its "Absent" tab had to carry
// `hrFlag=Absent` AND `dayType=working` together or it flooded HR with
// harmless Saturdays. That is no longer true -- day_state distinguishes
// `absent` from `weekend` natively, so the tab is a single condition again and
// can no longer be got wrong by omitting the second half.
//
// That also removes a real side effect worth naming: because every paramKey
// used by any tab is CLEARED on every tab click (see below), `dayType` being
// half of one tab's definition meant clicking ANY tab silently reset the
// user's independently-chosen "Day Type" dropdown. A tab clearing other tabs
// is intended; a tab clearing an unrelated dropdown was not.
//
// Attendance's tabs now share their paramKeys with dropdowns deliberately
// (the "Absent" tab and Day Type = Absent are the same filter reached two
// ways), so clearing stays coherent: the dropdown simply reflects whichever
// tab is active. Both shapes coexist so existing single-condition callers
// (Workspace's Overdue/Due Soon/Completed Late) don't need to change.
//
// `type` reuses the same grey/blue/yellow/green/red vocabulary
// `statusTypeMap` values already use, translated through the same
// STATUSBOX_TO_PILL_THEME map.
//
// Selecting ANY tab -- raw-status or extra -- clears every OTHER tracked
// param first, so exactly one tab ever reads active at a time: clicking
// "Overdue" after "To Do" was selected drops `status` when it sets
// `dueStatus`, and vice versa. A multi-condition tab clears/sets all of
// its own params atomically the same way. Untouched params (search,
// assignee, category, project, ...) are preserved exactly as buildTo
// already did.
export function buildStatusTabs({
  searchParams,
  statuses,
  statusTypeMap = {},
  paramKey = "status",
  extraTabs = [],
}) {
  const currentValue = searchParams.get(paramKey) || "";

  const normalizedExtraTabs = extraTabs.map((t) => ({
    label: t.label,
    type: t.type,
    conditions: t.conditions ?? [{ paramKey: t.paramKey, value: t.value }],
  }));

  const trackedParamKeys = [
    paramKey,
    ...new Set(normalizedExtraTabs.flatMap((t) => t.conditions.map((c) => c.paramKey))),
  ];

  const buildTo = (conditions) => {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    trackedParamKeys.forEach((k) => params.delete(k));
    conditions.forEach(({ paramKey: k, value }) => {
      if (value) {
        params.set(k, value);
      }
    });
    return `?${params.toString()}`;
  };

  const isTabActive = (conditions) =>
    conditions.every(({ paramKey: k, value }) => searchParams.get(k) === value);

  const isAnyExtraActive = normalizedExtraTabs.some((t) => isTabActive(t.conditions));

  const primaryTabs = [
    {
      label: "All",
      to: buildTo([{ paramKey, value: "" }]),
      themeType: "",
      isActive: !currentValue && !isAnyExtraActive,
    },
    ...statuses.map((s) => ({
      label: s.label,
      to: buildTo([{ paramKey, value: s.value }]),
      themeType: STATUSBOX_TO_PILL_THEME[statusTypeMap[s.value]] ?? "",
      isActive: currentValue === s.value && !isAnyExtraActive,
    })),
  ];

  const secondaryTabs = normalizedExtraTabs.map((t) => ({
    label: t.label,
    to: buildTo(t.conditions),
    themeType: STATUSBOX_TO_PILL_THEME[t.type] ?? "",
    isActive: isTabActive(t.conditions),
  }));

  return [...primaryTabs, ...secondaryTabs];
}
