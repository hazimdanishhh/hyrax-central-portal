// Pure functions, zero DB dependency -- shared by CaseCard, ChecklistItemCard,
// LifecycleCaseDetail, and EmployeeLifecycleCaseSummary so "what's the
// progress", "who's this waiting on", and "can this viewer act on this
// item" are each computed exactly once, not reimplemented per component.
import { ONBOARDING_CHECKLIST_ITEMS } from "../../../data/onboardingChecklistMeta";
import { OFFBOARDING_CHECKLIST_ITEMS } from "../../../data/offboardingChecklistMeta";

export function getChecklistMeta(caseType) {
  return caseType === "OFFBOARDING"
    ? OFFBOARDING_CHECKLIST_ITEMS
    : ONBOARDING_CHECKLIST_ITEMS;
}

export function getItemMeta(caseType, itemKey) {
  return getChecklistMeta(caseType).find((m) => m.key === itemKey);
}

// "Complete" mirrors check_lifecycle_case_completion.sql's own definition
// exactly: DONE + SKIPPED over every seeded item. Returns { completed,
// total } rather than a bare percentage -- callers decide how to render it
// (ProgressBar wants a 0-100 value, CaseCard's "3/12" label wants the raw
// counts).
export function computeProgress(items = []) {
  const total = items.length;
  const completed = items.filter((i) => i.status === "DONE" || i.status === "SKIPPED").length;
  return { completed, total };
}

export function getProgressPercentage(items = []) {
  const { completed, total } = computeProgress(items);
  if (total === 0) return null;
  return Math.round((100 * completed) / total);
}

// First not-yet-done item's owner, in fixed sortOrder -- the "waiting on:
// IT" badge computation. Returns null once every item is DONE/SKIPPED (no
// one left to wait on).
export function getWaitingOnOwner(items = [], caseType) {
  const meta = getChecklistMeta(caseType);
  const byKey = new Map(meta.map((m) => [m.key, m]));

  const sorted = [...items].sort(
    (a, b) => (byKey.get(a.item_key)?.sortOrder ?? 0) - (byKey.get(b.item_key)?.sortOrder ?? 0),
  );

  const next = sorted.find((i) => i.status !== "DONE" && i.status !== "SKIPPED");
  if (!next) return null;

  return byKey.get(next.item_key)?.owner ?? null;
}

// isSuperAdmin always can act; otherwise the viewer's own departmentSub
// must match the item's owning_department_sub (the DB-enforced column,
// not the JS meta's display-only `owner` -- they agree by construction,
// but this reads the DB value directly since that's what RLS actually
// checks). A SKIPPED or DERIVED item is never actionable by anyone --
// derived items only ever change via a backend sync trigger.
export function canActOnItem(item, itemMeta, { departmentSub, isSuperAdmin }) {
  if (!item || item.status === "SKIPPED") return false;
  if (itemMeta?.class === "DERIVED") return false;
  if (isSuperAdmin) return true;
  return !!item.owning_department_sub && item.owning_department_sub === departmentSub;
}

// Client-computed KPI counts for the list page's OverviewCards, over an
// already-fetched (unpaginated, per-case_type) case array -- same
// no-RPC, small-dataset convention useITAssetsOverview.js already
// established, not a new server round trip. STUCK_DAYS_THRESHOLD is a
// reasonable strawman (matches the 7-day windows used elsewhere in this
// module's notification design), not a confirmed business decision.
const STUCK_DAYS_THRESHOLD = 14;

export function computeCasesOverview(cases = []) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const openCases = cases.filter((c) => c.status === "OPEN");
  const completedThisMonthCount = cases.filter(
    (c) => c.status === "COMPLETED" && c.closed_at && new Date(c.closed_at) >= startOfMonth,
  ).length;
  const stuckCount = openCases.filter((c) => {
    const openedAt = c.opened_at ? new Date(c.opened_at) : null;
    if (!openedAt) return false;
    const daysOpen = (now.getTime() - openedAt.getTime()) / 86400000;
    return daysOpen > STUCK_DAYS_THRESHOLD;
  }).length;

  return {
    openCount: openCases.length,
    completedThisMonthCount,
    stuckCount,
  };
}
