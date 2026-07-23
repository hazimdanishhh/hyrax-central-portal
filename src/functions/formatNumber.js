/**
 * Compact currency formatting for boardroom-facing headline numbers, e.g.
 * "RM 21.3M" instead of "RM 21,332,649". Full precision stays available in
 * chart tooltips, sub-metrics, and drill-through views.
 */
export function compactCurrency(value) {
  const v = value || 0;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);

  if (abs >= 1_000_000) {
    return `RM ${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `RM ${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return `RM ${sign}${Math.round(abs).toLocaleString()}`;
}

/**
 * Currency-agnostic compact formatter for chart axes/ticks -- same tiering
 * as compactCurrency but no "RM " prefix, since it's shared by non-currency
 * charts too (counts on Sales Leads/Employee/IT Asset overview pages).
 * Includes a billions tier: chart values built from raw, unvalidated source
 * data can land far outside the millions range.
 */
export function compactNumber(value) {
  const v = value || 0;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return `${sign}${Math.round(abs).toLocaleString()}`;
}

/**
 * Full-precision, comma-separated formatter for tooltips/legends -- the
 * "closer inspection" counterpart to compactNumber's "at a glance" tiers.
 */
export function preciseNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value).toLocaleString()
    : value;
}
