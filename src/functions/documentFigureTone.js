/**
 * Shared color classifiers for a document card's "figures" row (Total/
 * Paid/Outstanding/Gross Profit/etc, styled via the plain .red/.green/
 * .yellow/.blue text-color utilities in styles/fonts.scss) -- reused across
 * InvoiceCard/BillCard/FulfillmentOrderCard so "what counts as fully
 * settled" and "what counts as a healthy margin" stay defined once instead
 * of drifting per card.
 */

// Oil & gas trading/distribution is a notoriously thin-margin business
// (commodity pricing, pass-through costs, heavy competition) -- unlike
// retail (~20-50%) or manufacturing (~25-35%), a "good" gross margin for a
// wholesale fuel/oil distributor/trader is commonly benchmarked in the
// 10-20% range, not the 50%+ often quoted as a general "healthy margin"
// rule of thumb. 15% sits in the middle of that band: at/above it is a
// genuinely strong result for this industry (green), 0-15% is a real but
// thin margin worth watching (yellow), negative is a loss (red).
const HEALTHY_MARGIN_RATIO = 0.15;
// Mirrors InvoiceCard/FulfillmentOrderCard's own "implausible gross
// profit" guard (a known SAP master-data defect, not a rendering choice)
// -- beyond this multiple of the document total, gp is blanked to "—"
// rather than trusted, so its tone is "no reliable figure" (blue), not
// red/green/yellow.
const IMPLAUSIBLE_GP_MULTIPLE = 5;

// "Fully (or over-) settled" vs "partially" vs "not at all" -- for
// Paid/Applied Payment/Invoiced/Delivered-style figures where 0 < actual <
// total is a real, distinct state from either extreme, not just "not
// done yet".
export function getAmountTone(actual, total) {
  const value = actual ?? 0;
  const target = total ?? 0;
  if (target > 0 && value >= target) return "green";
  if (value > 0) return "yellow";
  return "red";
}

// For figures that should simply be zero (Outstanding, Unallocated) --
// no meaningful partial state, so binary is correct, not a missing tier.
export function getBalanceTone(balance) {
  return (balance ?? 0) !== 0 ? "red" : "green";
}

export function getMarginTone(profit, total) {
  if (
    profit == null ||
    Math.abs(profit) > Math.abs(total ?? 0) * IMPLAUSIBLE_GP_MULTIPLE
  ) {
    return "blue";
  }
  if (profit >= (total ?? 0) * HEALTHY_MARGIN_RATIO) return "green";
  if (profit >= 0) return "yellow";
  return "red";
}
