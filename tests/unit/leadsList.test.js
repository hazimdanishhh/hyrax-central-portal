// The Leads LIST page's pilot UI (2026-10-27): the period picker's All time
// state, status-tab links that keep the rest of the URL, one active tab,
// and KPI cards whose links open exactly their own leads.
import { describe, expect, it } from "vitest";
import {
  describePeriod,
  periodToFilters,
  readPeriod,
} from "../../src/functions/periodRange";
import { tabLink } from "../../src/functions/statusTabs";
import {
  LEAD_TAB_KEYS,
  activeLeadTab,
  leadStatusTabs,
} from "../../src/pages/user/sales/leads/list/constants/tabConfig";
import { getLeadsListOverviewConfig } from "../../src/pages/user/sales/leads/list/constants/overviewConfig";

const params = (s) => new URLSearchParams(s);

describe("period picker: All time", () => {
  it("empty dates are All time on a list, this month on a report", () => {
    expect(readPeriod({}, "all")).toMatchObject({ mode: "all", startDate: "", endDate: "" });
    expect(describePeriod({}, "all")).toMatchObject({ mode: "all", title: "All time" });
    expect(readPeriod({}, "month").mode).toBe("month"); // reports unchanged
  });

  it("on a list, real periods are written out and All time is empty dates", () => {
    expect(periodToFilters({ mode: "all" }, "all")).toEqual({ startDate: "", endDate: "" });
    // the current month is NOT collapsed to empty dates on an all-time page
    const now = readPeriod({}, "month");
    expect(periodToFilters({ startDate: now.startDate, endDate: now.endDate }, "all"))
      .toEqual({ startDate: now.startDate, endDate: now.endDate });
    // ...while a report still writes its current month as empty dates
    expect(periodToFilters({ startDate: now.startDate, endDate: now.endDate }, "month"))
      .toEqual({ startDate: "", endDate: "" });
  });
});

describe("status tabs", () => {
  const current = params("startDate=2026-10-01&endDate=2026-10-31&owner=E1&search=oil&sortBy=title&page=3&stage=LOST");

  it("tabLink keeps the period, filters, search and sort; clears tab keys and the page", () => {
    const to = params(tabLink(current, { stage: "WON", cancelled: "false" }, LEAD_TAB_KEYS).slice(1));
    expect(Object.fromEntries(to)).toEqual({
      startDate: "2026-10-01", endDate: "2026-10-31", owner: "E1", search: "oil", sortBy: "title",
      stage: "WON", cancelled: "false",
    });
  });

  it("exactly one tab is active, the most specific match", () => {
    expect(activeLeadTab(params(""))).toBe("all");
    expect(activeLeadTab(params("stage=WON&pendingSapOrder=true&cancelled=false"))).toBe("pendingSap");
    expect(activeLeadTab(params("stage=WON&cancelled=false"))).toBe("WON");
    expect(activeLeadTab(params("activePipelineOnly=true&onHold=true"))).toBe("onHold");
    expect(activeLeadTab(params("activePipelineOnly=true&onHold=false&createdBefore=2026-09-27"))).toBe("active");
    const tabs = leadStatusTabs(params("stage=WON&pendingSapOrder=true"));
    expect(tabs.filter((t) => t.isActive).map((t) => t.key)).toEqual(["pendingSap"]);
  });
});

describe("Leads list KPI cards", () => {
  const kpis = {
    activeValue: 14000, activeCount: 2, weightedValue: 5400,
    pendingSapOrderValue: 1000, pendingSapOrderCount: 1,
    onHoldValue: 0, onHoldCount: 0, agingValue: 14000, agingCount: 2, agingCutoff: "2026-09-27",
  };
  const searchParams = params("startDate=2026-10-01&endDate=2026-10-31&owner=E1&stage=LOST");
  const period = describePeriod({ startDate: "2026-10-01", endDate: "2026-10-31" }, "all");
  const cards = Object.fromEntries(
    getLeadsListOverviewConfig(kpis, { searchParams, period }).map((c) => [c.label, c]),
  );

  it("say which window they count, in the leads' created date", () => {
    expect(cards["Active Pipeline"].sublabel).toBe("Created October 2026");
    const all = getLeadsListOverviewConfig(kpis, { searchParams: params(""), period: describePeriod({}, "all") });
    expect(all[0].sublabel).toBe("All time");
  });

  it("open their own tab and keep the period and salesperson", () => {
    const link = (label) => Object.fromEntries(params(cards[label].to.slice(1)));
    expect(link("Pending SAP")).toEqual({
      startDate: "2026-10-01", endDate: "2026-10-31", owner: "E1",
      stage: "WON", pendingSapOrder: "true", cancelled: "false",
    });
    // Aging uses the database's own cutoff, on its own key (not the period's endDate)
    expect(link("Aging 30+ Days")).toMatchObject({ createdBefore: "2026-09-27", endDate: "2026-10-31", onHold: "false" });
  });

  it("colour: Active is a plain figure; the rest are green at 0, amber above", () => {
    expect(cards["Active Pipeline"].variant).toBe("blueCard");
    expect(cards["On Hold"].variant).toBe("greenCard");
    expect(cards["Pending SAP"].variant).toBe("yellowCard");
  });
});
