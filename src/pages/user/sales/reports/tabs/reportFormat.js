// src/pages/user/sales/reports/tabs/reportFormat.js
//
// Wording shared by every Sales Reports tab, so a delta, a period label or a
// trend subtitle reads the same on all of them. Labels come from the `meta`
// block each tab RPC returns (the dates the numbers were computed with),
// never from dates recomputed here.

import {
  classifyRange,
  formatDateRange,
  formatPeriod,
} from "../../../../../functions/periodRange";

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

/** An attainment / rate that is null when there is no denominator. */
export function pctText(pct) {
  return pct === null || pct === undefined ? "—" : `${pct}%`;
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
