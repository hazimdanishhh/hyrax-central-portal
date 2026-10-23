// The projection tiles (src/pages/user/sales/reports/config/
// projectionConfig.js): the Forecast tab's composed set, and the single
// builders Summary picks from (2026-10-23). The composition must stay what
// the Forecast tab always showed.
import { describe, expect, it } from "vitest";
import {
  buildBiggestMissTile,
  buildReliabilityTile,
  buildSelectedMonthTile,
  buildThisMonthTile,
  buildYearTile,
  getSalesProjectionsConfig,
} from "../../src/pages/user/sales/reports/config/projectionConfig";

const year = {
  fiscalYearLabel: "2026-2027",
  isPastFiscalYear: false,
  isCurrentFiscalYear: true,
  budget: 30_000_000,
  budgetAttainmentPct: 92,
  outlook: 27_600_000,
  actualToDate: 15_000_000,
  currentMonthEstimate: 2_000_000,
  projectedRemainder: 10_600_000,
  lo80: 26_000_000,
  hi80: 29_000_000,
};
const current = {
  year,
  month: { currentLabel: "Oct 2026", currentEstimate: 2_000_000, nextPeriodMonth: "2026-11-01" },
  reliability: { typicalMissPct: 30, monthsScored: 6 },
  health: {},
};
const closed = {
  year: { ...year, isPastFiscalYear: true, isCurrentFiscalYear: false },
  month: { biggestMissLabel: "Aug 2025", biggestMissPct: 25 },
  reliability: { typicalMissPct: 30 },
  health: {},
};
const row = { periodMonth: "2026-11-01", name: "Nov 2026", segment: "future", projected: 2_500_000 };

describe("projection tiles", () => {
  it("the Forecast tab's set is the four builders, in order", () => {
    expect(getSalesProjectionsConfig(current, row)).toEqual([
      buildYearTile(current),
      buildSelectedMonthTile(current, row),
      buildThisMonthTile(current),
      buildReliabilityTile(current),
    ]);
    // A closed year has no month in progress: its biggest miss takes slot 3.
    expect(buildThisMonthTile(closed)).toBeNull();
    expect(getSalesProjectionsConfig(closed, row)[2]).toEqual(buildBiggestMissTile(closed));
    expect(getSalesProjectionsConfig(null, row)).toEqual([]);
  });

  it("Summary's compact year tile drops what its neighbours already show", () => {
    const full = buildYearTile(current).metrics.map((m) => m.label);
    const compact = buildYearTile(current, { compact: true }).metrics.map((m) => m.label);
    expect(full).toEqual(["Revenue Budget", "Invoiced so far", "Not yet closed", "80% range"]);
    expect(compact).toEqual(["Not yet closed", "80% range"]);
    expect(buildYearTile(current, { compact: true }).value).toBe(buildYearTile(current).value);
  });
});
