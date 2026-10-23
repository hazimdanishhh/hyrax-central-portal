// Wording shared by the Sales Reports tabs (src/pages/user/sales/reports/
// tabs/reportFormat.js): deltas, the comparison label, Same Period Last Year.
import { describe, expect, it } from "vitest";
import {
  calcDelta,
  comparedWith,
  lastYearMetric,
} from "../../src/pages/user/sales/reports/tabs/reportFormat";
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
});
