// The period picker's maths (src/functions/periodRange.js) and the nav
// active-link rule (src/functions/navPaths.js). Mirrors of the SQL rules in
// report_period() are checked in tests/sql/sales_metrics.test.js.
import { describe, expect, it } from "vitest";
import {
  classifyRange,
  fiscalYearStartYear,
  formatDateRange,
  formatMonthTick,
  formatPeriod,
  periodContaining,
  periodToFilters,
  readPeriod,
  shapeTrendRows,
  stepPeriod,
  todayDateString,
} from "../../src/functions/periodRange";
import { isNavActive, navTo } from "../../src/functions/navPaths";

describe("periodRange", () => {
  it.each([
    ["2026-10-01", "2026-10-31", "month"],
    ["2028-02-01", "2028-02-29", "month"],
    ["2028-02-01", "2028-02-28", "custom"],
    ["2026-10-01", "2026-12-31", "quarter"],
    ["2026-11-01", "2027-01-31", "custom"],
    ["2026-04-01", "2027-03-31", "fiscalYear"],
    ["2026-01-01", "2026-12-31", "year"],
    ["2026-10-02", "2026-10-31", "custom"],
  ])("classifyRange %s → %s = %s", (s, e, mode) => {
    expect(classifyRange(s, e)).toBe(mode);
  });

  it("finds the period containing a date", () => {
    expect(periodContaining("fiscalYear", "2027-02-14")).toEqual({ startDate: "2026-04-01", endDate: "2027-03-31" });
    expect(periodContaining("quarter", "2026-11-15")).toEqual({ startDate: "2026-10-01", endDate: "2026-12-31" });
  });

  it("steps whole periods, and custom ranges by their length", () => {
    expect(stepPeriod({ mode: "month", startDate: "2026-01-01", endDate: "2026-01-31" }, 1)).toEqual({ startDate: "2026-02-01", endDate: "2026-02-28" });
    expect(stepPeriod({ mode: "fiscalYear", startDate: "2026-04-01", endDate: "2027-03-31" }, -1)).toEqual({ startDate: "2025-04-01", endDate: "2026-03-31" });
    expect(stepPeriod({ mode: "custom", startDate: "2026-01-15", endDate: "2026-01-21" }, 1)).toEqual({ startDate: "2026-01-22", endDate: "2026-01-28" });
  });

  it("names periods, with fixed month names on every browser", () => {
    expect(formatPeriod({ mode: "quarter", startDate: "2026-10-01", endDate: "2026-12-31" }).title).toBe("Q3 FY 2026-2027");
    expect(formatPeriod({ mode: "fiscalYear", startDate: "2026-04-01", endDate: "2027-03-31" }).title).toBe("FY 2026-2027");
    expect(formatDateRange("2026-09-01", "2026-09-22")).toBe("1 Sep – 22 Sep 2026"); // never "Sept"
    expect(formatMonthTick("2026-09")).toBe("Sep '26");
    expect(fiscalYearStartYear("2027-02-01")).toBe(2026);
  });

  it("this month is written as empty dates (the RPC default)", () => {
    const cur = periodContaining("month", todayDateString());
    expect(periodToFilters(cur)).toEqual({ startDate: "", endDate: "" });
    expect(readPeriod({}).isDefault).toBe(true);
  });

  it("shapes trend rows from either RPC's flag names", () => {
    for (const [partial, inPeriod] of [["is_partial", "in_period"], ["isPartial", "inPeriod"]]) {
      const rows = [
        { period: "2026-09", [partial]: false, [inPeriod]: false },
        { period: "2026-10", [partial]: true, [inPeriod]: true },
      ];
      const shaped = shapeTrendRows(rows, (r) => formatMonthTick(r.period), () => ({}));
      expect(shaped.data.map((d) => d.name)).toEqual(["Sep '26", "Oct '26*"]);
      expect(shaped.highlight).toEqual({ from: "Oct '26*", to: "Oct '26*" });
    }
  });
});

describe("navPaths", () => {
  it.each([
    ["/app", "", true],
    ["/app/", "", true],
    ["/app/sales/reports", "", false],
    ["/app/notifications/", "notifications", true],
    ["/app/notificationsx", "notifications", false],
    ["/app/employee/attendance/list", "employee/attendance", true],
  ])("isNavActive(%s, %s) = %s", (pathname, path, expected) => {
    expect(isNavActive(pathname, path)).toBe(expected);
  });

  it("the dashboard link is /app, not /app/", () => {
    expect(navTo("")).toBe("/app");
  });
});
