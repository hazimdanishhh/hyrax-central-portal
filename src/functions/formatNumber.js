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
