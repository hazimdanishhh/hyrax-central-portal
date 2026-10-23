// Leads Overview tiles (src/pages/user/sales/leads/overview/config/
// overviewConfig.js): open balances read "Today" with no comparison, and
// every tile opens the Leads list on exactly its leads.
import { describe, expect, it } from "vitest";
import {
  getActivePipelineKpis,
  getPipelineKpis,
} from "../../src/pages/user/sales/leads/overview/config/overviewConfig";

const meta = {
  period: { startDate: "2025-05-01", endDate: "2025-05-31", hasPeriod: true },
  lastYearWindow: { startDate: "2024-05-01", endDate: "2024-05-31" },
};
const period = { title: "May 2025" };
const kpis = {
  generated: 10000, prevGenerated: 5000, lastYearGenerated: 8000, generatedCount: 1,
  won: 3000, prevWon: 2000, lastYearWon: 1500, wonCount: 2, avgDeal: 1500, wonExpected: 2500,
  target: 5000, targetAttainmentPct: 60,
  lost: 12000, lostCount: 2, winRatePct: 50, prevWinRatePct: 40, avgDaysToWon: 134,
  openValue: 14000, weightedValue: 5400, openCount: 2, pipelineCoverage: 2.5, targetRemaining: 5600,
  pendingSapValue: 1000, pendingSapCount: 1, onHoldValue: 0, onHoldCount: 0, agingValue: 14000, agingCount: 2,
};

describe("Leads Overview tiles", () => {
  const tiles = getPipelineKpis({ kpis, meta, period, against: "last month", owner: "E1" });
  const byLabel = Object.fromEntries(tiles.map((t) => [t.label, t]));

  it("period tiles left, the Today tile rightmost (R2)", () => {
    expect(tiles.map((t) => t.label)).toEqual(["Pipeline Generated", "Pipeline Won", "Win Rate", "Active Pipeline"]);
    expect(byLabel["Active Pipeline"].sublabel).toBe("Today");
    expect(byLabel["Active Pipeline"].subvalue).toBe(""); // no comparison for an open balance
    expect(byLabel["Pipeline Won"].subvalue).toBe("↑ 50% vs last month");
    expect(byLabel["Win Rate"].subvalue).toBe("↑ 10 pts vs last month"); // a rate moves in points
  });

  it("Won vs Expected is shown as the % difference with the expected value", () => {
    const m = byLabel["Pipeline Won"].metrics.find((x) => x.label === "vs Expected Value");
    expect(m.value).toBe("+20% (RM 2,500)");
  });

  it("links open the list on the same leads: won excludes cancelled, by close date", () => {
    expect(byLabel["Pipeline Won"].filter).toEqual({
      owner: "E1", stage: "WON", cancelled: "false", closedDateFrom: "2025-05-01", closedDateTo: "2025-05-31",
    });
    expect(byLabel["Pipeline Generated"].filter).toEqual({ owner: "E1", startDate: "2025-05-01", endDate: "2025-05-31" });
  });

  it("the day's work is Today: green when nothing waits, amber 'Watch' when something does", () => {
    const work = getActivePipelineKpis({ kpis, owner: null });
    expect(work.map((t) => [t.label, t.sublabel, t.variant, t.status?.label])).toEqual([
      ["Pending SAP Order Entry", "Today", "yellowCard", "Watch"],
      ["On Hold", "Today", "greenCard", "On track"], // never blue: blue is not a verdict
      ["Aging 30+ Days", "Today", "yellowCard", "Watch"],
    ]);
    expect(work[1].filter).toEqual({ activePipelineOnly: "true", onHold: "true" });
    expect(work[2].filter.onHold).toBe("false");
  });
});
