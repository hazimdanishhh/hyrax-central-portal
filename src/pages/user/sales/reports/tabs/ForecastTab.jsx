// src/pages/user/sales/reports/tabs/ForecastTab.jsx

import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { TrendUpIcon, WarningCircleIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import FanChartRenderer from "../../../../../components/chartCard/FanChartRenderer";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import {
  BLUE_COLOR,
  PURPLE_COLOR,
} from "../../../../../components/chartCard/chartColors";
import { fiscalYearStartYear } from "../../../../../functions/periodRange";
import { useSalesProjections } from "../../../../../features/sales/reports/private/hooks/useSalesProjections";
import { getSalesProjectionsConfig } from "../config/projectionConfig";
import ReportSection from "./ReportSection";
import TabState from "./TabState";

/**
 * FORECAST -- the projections section of the single-page report, moved to
 * its own tab unchanged (get_sales_projections, projectionConfig.js,
 * docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md), with one difference
 * (decision D6): the fiscal year is no longer its own dropdown -- it is the
 * fiscal year of the page's selected period, so the whole page runs on one
 * clock. The forecast is company-wide; the layout replaces the salesperson
 * filter with a note on this tab.
 *
 * Clicking a month on the fan chart re-points tile 2 and both exhibit charts,
 * exactly as before.
 */
export default function ForecastTab() {
  const { period } = useOutletContext();
  const fyStartYear = fiscalYearStartYear(period.startDate);

  const {
    kpis: projectionKpis,
    monthlyData: projectionMonthly,
    exhibitsByMonth,
    defaultExhibitMonth,
    isLoading,
    error,
  } = useSalesProjections(fyStartYear);

  // The clicked month, remembered per fiscal year: changing the period to
  // another FY must not leave a month from the old year selected.
  const [selection, setSelection] = useState({ fy: null, month: null });
  const selectedMonth = selection.fy === fyStartYear ? selection.month : null;
  const focusedMonth = selectedMonth ?? defaultExhibitMonth ?? null;
  const focusedRow =
    (projectionMonthly ?? []).find((r) => r.periodMonth === focusedMonth) || null;
  const focusedExhibit = focusedMonth ? exhibitsByMonth?.[focusedMonth] : null;

  const projectionItems = getSalesProjectionsConfig(projectionKpis, focusedRow);

  // The chart hands up the X-axis label; monthlyData maps it back to the
  // RPC's own month key (DASHBOARD-CONVENTIONS §4d -- never parse a label).
  function handleMonthClick(name) {
    const row = (projectionMonthly ?? []).find((r) => r.name === name);
    if (row?.periodMonth) setSelection({ fy: fyStartYear, month: row.periodMonth });
  }

  const health = projectionKpis?.health;
  const fyLabel = projectionKpis?.year?.fiscalYearLabel ?? "";

  return (
    <TabState isLoading={isLoading} error={error}>
      <ReportSection
        icon={TrendUpIcon}
        title="Projected Invoiced Revenue"
        description={`FY ${fyLabel}, company-wide: forecast against actual invoiced revenue.`}
      >
        {!health?.monthsWithData ? (
          <NoResult title={`No forecast or actuals for FY ${fyLabel || fyStartYear} yet.`} />
        ) : (
          <>
            <OverviewCards items={projectionItems} />

            {health?.cacheStale && (
              <p className="textXS textLight">
                <WarningCircleIcon size={14} /> Projection caches were last
                rebuilt through {health.cacheLatestMonth}, but invoicing is
                closed through {health.seriesLatestCompleteMonth}. These figures
                do not yet include the most recent closed month.
              </p>
            )}

            <CardLayout style="cardLayout1">
              <ChartCard
                title="Invoiced Revenue — Forecast vs Actual"
                subtitle={`FY ${fyLabel} · ${projectionKpis?.reliability?.monthsScored ?? 0} closed months scored · 80% and 95% ranges · click a month${
                  health?.monthsBeyondValidated
                    ? ` · ${health.monthsBeyondValidated} month(s) past the validated six`
                    : ""
                }`}
                style="cardGapSmall"
              >
                <FanChartRenderer
                  data={projectionMonthly}
                  forecastStartLabel={health?.forecastStartLabel}
                  onMonthClick={handleMonthClick}
                  selectedMonth={focusedRow?.name}
                />
              </ChartCard>
            </CardLayout>
          </>
        )}
      </ReportSection>

      {health?.monthsWithData ? (
        <ReportSection
          icon={TrendUpIcon}
          title="Forecast Model Detail"
          description={`${focusedRow?.name ?? "The selected month"}: each model's estimate and how the forecast is built. Click a month on the chart above to change it.`}
        >
          <CardLayout style="cardLayout2">
            <ChartCard
              title="What Each Model Says — Invoiced Revenue"
              subtitle={`${focusedRow?.name ?? "Selected month"} — each method's own estimate, and the blend published from them${
                focusedExhibit?.basis ? ` · ${focusedExhibit.basis}` : ""
              }`}
              style="cardGapSmall"
            >
              {focusedExhibit?.methods?.length ? (
                <HorizontalBarChartRenderer
                  data={focusedExhibit.methods}
                  colorMap={PURPLE_COLOR}
                />
              ) : (
                <NoResult title="No per-model breakdown for this month." />
              )}
            </ChartCard>

            <ChartCard
              title="How the Number Is Built — Invoiced Revenue"
              subtitle={`${focusedRow?.name ?? "Selected month"} — how much comes from the order book, how much from invoicing history${
                focusedExhibit?.basis ? ` · ${focusedExhibit.basis}` : ""
              }`}
              style="cardGapSmall"
            >
              {focusedExhibit?.buildUp?.length ? (
                <HorizontalBarChartRenderer
                  data={focusedExhibit.buildUp}
                  colorMap={BLUE_COLOR}
                />
              ) : (
                <NoResult title="No build-up for this month." />
              )}
            </ChartCard>
          </CardLayout>
        </ReportSection>
      ) : null}
    </TabState>
  );
}
