// src/functions/reportFormat.js (shared by every report and overview page)
//
// Wording shared by every Sales Reports tab, so a delta, a period label or a
// trend subtitle reads the same on all of them. Labels come from the `meta`
// block each tab RPC returns (the dates the numbers were computed with),
// never from dates recomputed here.

import {
  classifyRange,
  formatDateRange,
  formatPeriod,
} from "./periodRange";
import { getStatusVariant } from "./statusVariant";

// ─── Gross Margin release gate ──────────────────────────────────────────────
// Gross Margin (Invoicing) and Gross Profit by Rep (Team) show only once
// hyrax-supabase/archive/portal/supabase/diagnostics/sales_gross_profit_coverage.sql finds SAP's gross
// profit known for 95%+ of Invoiced Revenue over the last 12 months (plan,
// final build §4). Flip to true when it passes; if it fails, delete the
// gated tile/chart and record why in docs/sales/SALES-REPORTS-TABS-PLAN.md.
export const GROSS_MARGIN_RELEASED = false;

// ─── Status thresholds ──────────────────────────────────────────────────────
// One copy of each attainment bar, used by the tiles' colour, the Team
// scorecard's colours AND its check-in flags -- a rep is flagged exactly
// when the same figure on a tile would read Critical. Documented estimates,
// not audited targets (DASHBOARD-CONVENTIONS §4).
export const TARGET_THRESHOLDS = { warningAt: 60, goodAt: 90 }; // Pipeline Won vs Pipeline Target
export const BUDGET_THRESHOLDS = { warningAt: 70, goodAt: 95 }; // Invoiced Revenue vs Revenue Budget
// Overdue as a share of Outstanding (low is good). A starting point: AR
// guidance treats 70-80% current as healthy and 90+ above 5% as systemic.
export const OVERDUE_SHARE_THRESHOLDS = { warningAt: 30, criticalAt: 50 };

/** A tile's { variant, status } from getStatusVariant, ready to spread in. */
function toTileStatus(s, label) {
  return {
    variant: s.variant,
    status: s.statusIcon ? { icon: s.statusIcon, label: label ?? s.statusLabel } : undefined,
  };
}

/**
 * "Something to act on" tiles (DASHBOARD-CONVENTIONS §4, 2026-10-23):
 * Pending SAP Order Entry, On Hold, Aging, Overdue Delivery, Delivered Not
 * Invoiced. Zero is the good state, so these ARE evaluated tiles: green
 * "On track" at zero, amber "Watch" above -- with the status badge, never
 * colour alone, and never blue (blue is never a verdict). Two tiers: each
 * is a task waiting, not a failure, so there is no red; amber stays a tint
 * (fill is for a worst tier that is a real failure).
 */
export function actionTileStatus(count) {
  if (count === null || count === undefined) return { variant: "blueCard", status: undefined };
  return toTileStatus(
    getStatusVariant(Number(count), {
      direction: "low-good",
      tiers: 2,
      badLevel: "warning",
      thresholds: { criticalAt: 1 },
      fill: "never",
    }),
  );
}

/**
 * Monthly Invoicing Needed: green when the monthly average so far already
 * covers what is needed, amber when a faster pace is needed. No red: a
 * pace to pick up is not a verdict on its own. null -> blue (no budget).
 */
export function paceTileStatus(onPace) {
  if (onPace === null || onPace === undefined) return { variant: "blueCard", status: undefined };
  return toTileStatus(
    getStatusVariant(onPace ? 0 : 1, {
      direction: "low-good",
      tiers: 2,
      badLevel: "warning",
      thresholds: { criticalAt: 1 },
      fill: "never",
    }),
    onPace ? "On pace" : "Above current pace",
  );
}

/** % change from previous to current; null when there's nothing to compare. */
export function calcDelta(current, previous) {
  if (previous === null || previous === undefined) return null;
  if (current === null || current === undefined) return null;
  if (Number(previous) === 0) return Number(current) === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/**
 * What every delta compares against: the exact days while the period is
 * still running ("1 Sep – 22 Sep 2026", like-for-like), otherwise the
 * previous whole period ("last month").
 */
export function comparedWith(meta, period) {
  const w = meta?.comparisonWindow;
  if (w?.isPartial) return formatDateRange(w.startDate, w.endDate);
  return period.previousLabel;
}

export function deltaText(delta, against) {
  if (delta === null || delta === undefined) return "";
  return delta >= 0
    ? `↑ ${delta}% vs ${against}`
    : `↓ ${Math.abs(delta)}% vs ${against}`;
}

/**
 * The "Same Period Last Year" sub-metric row every headline tile carries
 * (2026-10-23): last year's figure for the same dates (meta.lastYearWindow,
 * cut to the same days while the period is still running) with the change
 * in brackets. `format` renders the figure (e.g. preciseCurrency).
 */
export function lastYearMetric(meta, current, lastYear, format) {
  const w = meta?.lastYearWindow;
  const delta = calcDelta(current, lastYear);
  const change =
    delta === null ? "" : ` (${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta)}%)`;
  return {
    label: "Same Period Last Year",
    value: lastYear === null || lastYear === undefined ? "—" : `${format(lastYear)}${change}`,
    title: w ? formatDateRange(w.startDate, w.endDate) : undefined,
  };
}

/** lastYearMetric for a RATE (margin, win rate): the change in points. */
export function lastYearRateMetric(meta, current, lastYear) {
  const w = meta?.lastYearWindow;
  const change =
    current === null || current === undefined || lastYear === null || lastYear === undefined
      ? null
      : Math.round((current - lastYear) * 10) / 10;
  return {
    label: "Same Period Last Year",
    value:
      lastYear === null || lastYear === undefined
        ? "—"
        : `${lastYear}%${change === null ? "" : ` (${change >= 0 ? "↑" : "↓"} ${Math.abs(change)} pts)`}`,
    title: w ? formatDateRange(w.startDate, w.endDate) : undefined,
  };
}

/** An attainment / rate that is null when there is no denominator. */
export function pctText(pct) {
  return pct === null || pct === undefined ? "—" : `${pct}%`;
}

/**
 * Change of a RATE (win rate, margin) in percentage points -- a % change of
 * a % ("win rate up 20%") is ambiguous, points are not. "" with no pair.
 */
export function pointsDeltaText(current, previous, against) {
  if (current === null || current === undefined) return "";
  if (previous === null || previous === undefined) return "";
  const change = Math.round((current - previous) * 10) / 10;
  return `${change >= 0 ? "↑" : "↓"} ${Math.abs(change)} pts vs ${against}`;
}

/**
 * An OPEN BALANCE tile (DASHBOARD-CONVENTIONS §8 R3): a snapshot of today,
 * whatever period is picked. It says "Today", and gets no previous-period
 * comparison (subvalue, where every tile's "vs last month" goes) and no
 * Same Period Last Year -- no history of balances exists, and a
 * period-bound stand-in would be a different fact. Every such tile on every
 * tab goes through here, so none can quietly grow a comparison. `delta`
 * (the headline share, e.g. "% of Outstanding") is kept.
 */
export function todayTile(tile) {
  return {
    ...tile,
    sublabel: tile.sublabel ? `Today · ${tile.sublabel}` : "Today",
    subvalue: "",
  };
}

/**
 * The budget bridge (waterfall), BridgeChartRenderer's rows:
 * Revenue Budget -> each rep's shortfall (worst first) -> reps at or above
 * budget -> invoiced with no budget set -> Invoiced Revenue. The steps add
 * up exactly: budget + (invoiced - budget per budgeted rep) + unbudgeted
 * invoicing = invoiced. Reps without a budget row are kept OUT of the
 * variances (their whole invoicing would read as overperformance) and shown
 * on their own step. Rows come from sales_rep_totals, so the end bar equals
 * the Invoiced Revenue tile.
 */
export function buildBudgetBridge(rows) {
  const budgeted = rows.filter((r) => (r.budget ?? 0) > 0);
  const unbudgeted = rows.filter((r) => !((r.budget ?? 0) > 0));
  if (!budgeted.length && !unbudgeted.length) return [];

  const totalBudget = budgeted.reduce((a, r) => a + Number(r.budget), 0);
  const variances = budgeted
    .map((r) => ({ name: r.name, value: (Number(r.invoiced) || 0) - Number(r.budget) }))
    .sort((a, b) => a.value - b.value);
  const behind = variances.filter((v) => v.value < 0);
  const aheadTotal = variances
    .filter((v) => v.value >= 0)
    .reduce((a, v) => a + v.value, 0);
  const unbudgetedTotal = unbudgeted.reduce((a, r) => a + (Number(r.invoiced) || 0), 0);
  const invoiced = rows.reduce((a, r) => a + (Number(r.invoiced) || 0), 0);

  return [
    { name: "Revenue Budget", value: totalBudget, kind: "start" },
    ...behind.map((v) => ({ ...v, kind: "delta" })),
    ...(aheadTotal > 0
      ? [
          {
            name: `Reps at or above budget (${variances.length - behind.length})`,
            value: aheadTotal,
            kind: "delta",
          },
        ]
      : []),
    ...(unbudgetedTotal > 0
      ? [
          {
            name: `Invoiced with no budget set (${unbudgeted.length})`,
            value: unbudgetedTotal,
            kind: "delta",
          },
        ]
      : []),
    { name: "Invoiced Revenue", value: invoiced, kind: "end" },
  ];
}

/** The page filters as link params (empty values dropped). */
export function filtersForLink(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
}

/** "FY 2026-2027" etc. for a { startDate, endDate } window from meta. */
export function windowTitle(window, fallback = "") {
  if (!window?.startDate || !window?.endDate) return fallback;
  return formatPeriod({
    mode: classifyRange(window.startDate, window.endDate),
    ...window,
  }).title;
}

/** Monthly trend chart subtitle: window, the shaded selection, "*". */
export function trendSubtitle(meta, period, shaped) {
  return [
    `Monthly, ${windowTitle(meta?.trendWindow, period.title)}`,
    shaped.highlight && `${period.title} shaded`,
    shaped.hasPartial && "* month to date",
  ]
    .filter(Boolean)
    .join(" · ");
}

// ─── Drill-through filters ──────────────────────────────────────────────────
// Tile and chart links reproduce the exact window and salesperson the figure
// was computed under, read back from meta (never re-derived here).

/** startDate/endDate of the period the RPC used (explicit even by default). */
export function periodLinkFilter(meta) {
  const p = meta?.period;
  return p ? { startDate: p.startDate, endDate: p.endDate } : {};
}

/** The resolved SAP rep, for links to SAP lists (orders, invoices). */
export function repLinkFilter(meta) {
  const rep = meta?.salesRepCode;
  return rep === null || rep === undefined ? {} : { salesRepCode: rep };
}
