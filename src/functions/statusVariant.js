// functions/statusVariant.js
//
// Shared severity-to-card-variant mapping for OverviewCards' dynamic (value-
// driven) KPI tiles -- see docs/DASHBOARD-CONVENTIONS.md's "KPI Card Color &
// Fill Convention" section for the full rationale. Static hero/informational
// tiles don't call this at all; they keep hardcoding "blueCardFill"/"blueCard"
// directly, same as before this utility existed.
import {
  CheckCircleIcon,
  WarningCircleIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";

const LEVEL_META = {
  good: { base: "greenCard", statusIcon: CheckCircleIcon, statusLabel: "On track" },
  warning: { base: "yellowCard", statusIcon: WarningCircleIcon, statusLabel: "Watch" },
  critical: { base: "redCard", statusIcon: WarningOctagonIcon, statusLabel: "Critical" },
};

function resolveLevel(value, { direction, thresholds = {}, tiers, badLevel }) {
  if (direction === "high-good") {
    // Bigger is better. thresholds: { warningAt, goodAt } -- ascending floors,
    // each the smallest value that earns that tier or better.
    const { warningAt, goodAt } = thresholds;
    if (value >= goodAt) return "good";
    if (tiers === 2) return badLevel;
    return value >= warningAt ? "warning" : "critical";
  }

  if (direction === "low-good") {
    // Smaller is better. thresholds: { warningAt, criticalAt } -- ascending
    // floors, each the smallest value that tips into that tier or worse.
    const { warningAt, criticalAt } = thresholds;
    if (tiers === 2) return value >= criticalAt ? badLevel : "good";
    if (value >= criticalAt) return "critical";
    return value >= warningAt ? "warning" : "good";
  }

  if (direction === "sign-good") {
    // Must stay non-negative -- crossing zero is a qualitatively different
    // (critical) state, not just a smaller number. thresholds:
    // { warningRatio, warningFloor } -- an optional companion ratio (e.g. a
    // margin %) that, when still below its own floor, downgrades an
    // otherwise-positive value to "warning".
    if (value < 0) return "critical";
    const { warningRatio, warningFloor } = thresholds;
    if (warningRatio !== undefined && warningRatio < warningFloor) return "warning";
    return "good";
  }

  if (direction === "target-band") {
    // Value should sit near a target, in either direction. thresholds:
    // { target, warningTolerance, criticalTolerance } -- absolute deltas.
    const { target, warningTolerance, criticalTolerance } = thresholds;
    const delta = Math.abs(value - target);
    if (delta <= warningTolerance) return "good";
    return delta <= criticalTolerance ? "warning" : "critical";
  }

  throw new Error(`getStatusVariant: unknown direction "${direction}"`);
}

/**
 * getStatusVariant(value, options) -> { level, variant, statusIcon, statusLabel }
 *
 * Fill is reserved for the single worst tier this tile's own structure
 * defines (tiers:3 -> only "critical"; tiers:2 -> whichever level badLevel
 * names) -- "good" and any middle "warning" reading always tint. Pass
 * fill:"never" to opt a tile out of filling even at its worst tier.
 *
 * Returns the neutral/informational shape (blue tint, no status badge) when
 * value is null/undefined -- e.g. no prior-period data -- never guesses a
 * tier for missing data.
 */
export function getStatusVariant(value, options) {
  const { tiers = 3, badLevel = "critical", fill = "auto" } = options;

  if (value === null || value === undefined) {
    return { level: null, variant: "blueCard", statusIcon: null, statusLabel: null };
  }

  const level = resolveLevel(value, { ...options, tiers, badLevel });
  const worstLevel = tiers === 2 ? badLevel : "critical";
  const meta = LEVEL_META[level];
  const shouldFill = fill !== "never" && level === worstLevel;

  return {
    level,
    variant: shouldFill ? `${meta.base}Fill` : meta.base,
    statusIcon: meta.statusIcon,
    statusLabel: meta.statusLabel,
  };
}
