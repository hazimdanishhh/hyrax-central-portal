// Wording shared by the Sales Reports tabs (src/pages/user/sales/reports/
// tabs/reportFormat.js): deltas, the comparison label, Same Period Last Year.
import { describe, expect, it } from "vitest";
import {
  actionTileStatus,
  paceTileStatus,
  buildBudgetBridge,
  calcDelta,
  comparedWith,
  lastYearMetric,
  lastYearRateMetric,
  pointsDeltaText,
  todayTile,
} from "../../src/functions/reportFormat";
import { formatDay } from "../../src/functions/periodRange";

const money = (v) => `RM ${v}`;

describe("reportFormat", () => {
  it("calcDelta is null when there is nothing honest to compare", () => {
    expect(calcDelta(110, 100)).toBe(10);
    expect(calcDelta(90, 100)).toBe(-10);
    expect(calcDelta(5, 0)).toBeNull(); // no % change from zero
    expect(calcDelta(0, 0)).toBe(0);
    expect(calcDelta(5, null)).toBeNull();
  });

  it("comparedWith names the exact days while a period is running", () => {
    const period = { previousLabel: "last month" };
    expect(comparedWith({ comparisonWindow: { isPartial: false } }, period)).toBe("last month");
    expect(
      comparedWith(
        { comparisonWindow: { isPartial: true, startDate: "2026-09-01", endDate: "2026-09-22" } },
        period,
      ),
    ).toBe("1 Sep – 22 Sep 2026");
  });

  it("lastYearMetric shows last year's figure with the change, dated in its tooltip", () => {
    const meta = { lastYearWindow: { startDate: "2025-05-01", endDate: "2025-05-31" } };
    expect(lastYearMetric(meta, 1200, 1000, money)).toEqual({
      label: "Same Period Last Year",
      value: "RM 1000 (↑ 20%)",
      title: "1 May – 31 May 2025",
    });
    expect(lastYearMetric(meta, 800, 1000, money).value).toBe("RM 1000 (↓ 20%)");
    expect(lastYearMetric(meta, 800, 0, money).value).toBe("RM 0"); // no % from zero
    expect(lastYearMetric({}, 800, null, money).value).toBe("—");
  });

  it("formatDay", () => {
    expect(formatDay("2026-10-23")).toBe("23 Oct 2026");
  });

  it("rates change in points, never in %", () => {
    expect(pointsDeltaText(52.5, 50, "last month")).toBe("↑ 2.5 pts vs last month");
    expect(pointsDeltaText(40, 50, "last month")).toBe("↓ 10 pts vs last month");
    expect(pointsDeltaText(40, null, "last month")).toBe("");
    const meta = { lastYearWindow: { startDate: "2025-05-01", endDate: "2025-05-31" } };
    expect(lastYearRateMetric(meta, 16.5, 15).value).toBe("15% (↑ 1.5 pts)");
    expect(lastYearRateMetric(meta, 16.5, null).value).toBe("—");
  });

  it("action tiles: green 'On track' at zero, amber 'Watch' tint above, never blue", () => {
    expect(actionTileStatus(0)).toMatchObject({ variant: "greenCard", status: { label: "On track" } });
    expect(actionTileStatus(3)).toMatchObject({ variant: "yellowCard", status: { label: "Watch" } });
    expect(actionTileStatus(3).status.icon).toBeTruthy(); // a badge, never colour alone
    expect(actionTileStatus(null)).toEqual({ variant: "blueCard", status: undefined }); // no data
  });

  it("pace tile: green on pace, amber above it, blue without a budget", () => {
    expect(paceTileStatus(true)).toMatchObject({ variant: "greenCard", status: { label: "On pace" } });
    expect(paceTileStatus(false)).toMatchObject({ variant: "yellowCard", status: { label: "Above current pace" } });
    expect(paceTileStatus(null).variant).toBe("blueCard");
  });

  it("todayTile: says Today and can never carry a period comparison", () => {
    const t = todayTile({ label: "Open Backlog", subvalue: "↑ 5% vs last month", delta: "40%" });
    expect(t.sublabel).toBe("Today");
    expect(t.subvalue).toBe("");
    expect(t.delta).toBe("40%"); // a headline share is not a comparison
    expect(todayTile({ label: "X", sublabel: "Orders" }).sublabel).toBe("Today · Orders");
  });

  it("budget bridge: steps add up from Revenue Budget to Invoiced Revenue", () => {
    const rows = [
      { name: "Ali", invoiced: 1100, budget: 3100 }, // -2000
      { name: "Bob", invoiced: 900, budget: 620 }, // +280
      { name: "Cara", invoiced: 400, budget: 500 }, // -100
      { name: "Unassigned", invoiced: 300, budget: null }, // no budget: own step
    ];
    const bridge = buildBudgetBridge(rows);
    expect(bridge.map((b) => [b.name, b.value, b.kind])).toEqual([
      ["Revenue Budget", 4220, "start"],
      ["Ali", -2000, "delta"], // worst first
      ["Cara", -100, "delta"],
      ["Reps at or above budget (1)", 280, "delta"],
      ["Invoiced with no budget set (1)", 300, "delta"],
      ["Invoiced Revenue", 2700, "end"],
    ]);
    const walked = bridge
      .filter((b) => b.kind === "delta")
      .reduce((s, b) => s + b.value, bridge[0].value);
    expect(walked).toBe(bridge.at(-1).value);
    expect(buildBudgetBridge([])).toEqual([]);
  });
});
