// src/pages/user/sales/reports/tabs/SummaryTab.jsx

import { Link, useLocation, useOutletContext } from "react-router-dom";
import {
  CalendarCheckIcon,
  ChartLineUpIcon,
  FileTextIcon,
  FunnelIcon,
  GaugeIcon,
  GlobeHemisphereEastIcon,
  HourglassMediumIcon,
  PackageIcon,
  ReceiptIcon,
  ScalesIcon,
  SpeedometerIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import BridgeChartRenderer from "../../../../../components/chartCard/BridgeChartRenderer";
import VerticalMultiBarRenderer from "../../../../../components/chartCard/VerticalMultiBarRenderer";
import { MEASURE_COLORS } from "../../../../../components/chartCard/chartColors";
import { preciseCurrency } from "../../../../../functions/formatNumber";
import { getStatusVariant } from "../../../../../functions/statusVariant";
import {
  fiscalYearStartYear,
  formatDay,
  formatMonthTick,
  shapeTrendRows,
} from "../../../../../functions/periodRange";
import { useSalesReportTab } from "../../../../../features/sales/reports/private/hooks/useSalesReportTab";
import { useSalesProjections } from "../../../../../features/sales/reports/private/hooks/useSalesProjections";
import {
  buildSelectedMonthTile,
  buildThisMonthTile,
  buildYearTile,
} from "../config/projectionConfig";
// PARKED 2026-10-23 -- the AI Meeting Brief is built but NOT deployed or
// used (see MeetingBrief.jsx). Re-enable this import and the section below
// together.
// import MeetingBrief from "./MeetingBrief";
import ReportSection from "../../../../../components/report/ReportSection";
import TabState from "../../../../../components/report/TabState";
import {
  BUDGET_THRESHOLDS,
  TARGET_THRESHOLDS,
  buildBudgetBridge,
  calcDelta,
  comparedWith,
  deltaText,
  filtersForLink,
  lastYearMetric,
  pctText,
  repLinkFilter,
  paceTileStatus,
  todayTile,
} from "../../../../../functions/reportFormat";

/**
 * SUMMARY -- the meeting's opening page (layer 1: answer first). Data:
 * get_sales_summary, plus get_sales_projections for the projection tiles.
 * Rules: DASHBOARD-CONVENTIONS §8. Top to bottom:
 *
 *   (Meeting Brief           the AI summary for this period and salesperson
 *                            -- PARKED 2026-10-23, built but not deployed or
 *                            rendered; see MeetingBrief.jsx)
 *   Sales KPIs               the funnel for the period -- Pipeline Won ->
 *                            Sales Orders -> Invoiced Revenue -> Payments
 *                            Collected -- each opening its own tab
 *   Fiscal Year Progress     FY to date vs budget, the monthly pace still
 *                            needed, the full-year outlook (R8), and the
 *                            cumulative FY-to-date line
 *   Budget Variance          where the gap to budget came from, by rep (R7)
 *   Open Position            what is open TODAY: Active Pipeline, Open
 *                            Backlog, Outstanding Invoices -- each its own
 *                            tab's figure (R3)
 *   Order-to-Cash YoY        the long view
 *
 * Company-wide figures never sit beside a salesperson's (R10): with a
 * salesperson picked, the projection tiles and the budget bridge (one bar
 * is no bridge) are replaced by a note.
 */
export default function SummaryTab() {
  const { filters, period, MappingMissingNote } = useOutletContext();
  const { search } = useLocation();
  const { data, meta, kpis, isLoading, isUpdating, error } = useSalesReportTab(
    "summary",
    filters,
  );
  const repPicked = Boolean(filters.owner);

  // The projection tiles follow the fiscal year of the selected period and
  // are the Forecast tab's own builders (projectionConfig.js), so the two
  // tabs can't disagree. Month tile: the month in progress gets This Month
  // (invoiced so far + the run rate for the days left); any other selected
  // month gets its own tile; a longer period gets the forecast's default
  // month -- This Month again while that FY is running.
  const fyStartYear = fiscalYearStartYear(period.startDate);
  const {
    kpis: projectionKpis,
    monthlyData: projectionMonthly,
    defaultExhibitMonth,
    isUpdating: projectionsUpdating,
  } = useSalesProjections(fyStartYear);
  const now = new Date(); // local time: the month in progress here
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthKey =
    period.mode === "month" ? String(period.startDate).slice(0, 7) : null;
  const projectionMonthRow =
    (projectionMonthly ?? []).find(
      (r) =>
        String(r.periodMonth).slice(0, 7) ===
        String(monthKey ?? defaultExhibitMonth).slice(0, 7),
    ) || null;
  const thisMonthTile =
    monthKey === null || monthKey === thisMonthKey
      ? buildThisMonthTile(projectionKpis)
      : null;
  const projectionTiles = repPicked
    ? []
    : [
        buildYearTile(projectionKpis, { compact: true }),
        thisMonthTile ?? buildSelectedMonthTile(projectionKpis, projectionMonthRow),
      ]
        .filter(Boolean)
        .map((tile) => ({
          ...tile,
          sublabel: [tile.sublabel, "Company-wide"].filter(Boolean).join(" · "),
          to: "../forecast",
          filter: filtersForLink(filters),
        }));

  const against = comparedWith(meta, period);
  // Each tile opens its stage's tab, keeping the period and salesperson; the
  // stage tabs link on to the list pages.
  const tabFilter = filtersForLink(filters);
  const repFilter = repLinkFilter(meta);
  const ownerFilter = filters.owner ? { owner: filters.owner } : {};

  const budgetStatus = getStatusVariant(kpis.budgetAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: BUDGET_THRESHOLDS,
  });
  const targetStatus = getStatusVariant(kpis.targetAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: TARGET_THRESHOLDS,
  });

  const salesKpis = [
    {
      icon: GaugeIcon,
      label: "Pipeline Won",
      sublabel: `${period.title} · vs Pipeline Target`,
      value: preciseCurrency(kpis.won),
      delta: pctText(kpis.targetAttainmentPct),
      subvalue: deltaText(calcDelta(kpis.won, kpis.prevWon), against),
      variant: targetStatus.variant,
      status: targetStatus.statusIcon
        ? { icon: targetStatus.statusIcon, label: targetStatus.statusLabel }
        : undefined,
      to: "../pipeline",
      filter: tabFilter,
      metrics: [
        {
          label: "Pipeline Target",
          value: kpis.target == null ? "none set" : preciseCurrency(kpis.target),
          to: "/app/sales/leads/targets",
          filter: { ...ownerFilter },
        },
        lastYearMetric(meta, kpis.won, kpis.lastYearWon, preciseCurrency),
      ],
      title:
        "Revenue on leads won in the period (cancelled leads excluded; close date " +
        "in Malaysia time), against the Pipeline Target. " +
        "Colour: Critical below 60% of target, Watch 60–89%, On track at 90%+.",
    },
    {
      icon: FileTextIcon,
      label: "Sales Orders",
      sublabel: period.title,
      value: preciseCurrency(kpis.booked),
      subvalue: deltaText(calcDelta(kpis.booked, kpis.prevBooked), against),
      variant: "blueCard",
      to: "../orders",
      filter: tabFilter,
      metrics: [
        { label: "Order Count", value: kpis.orderCount ?? 0 },
        lastYearMetric(meta, kpis.booked, kpis.lastYearBooked, preciseCurrency),
      ],
      title: "Sales orders placed in the period, not cancelled.",
    },
    {
      icon: ReceiptIcon,
      label: "Invoiced Revenue",
      sublabel: `${period.title} · vs Revenue Budget`,
      value: preciseCurrency(kpis.invoiced),
      delta: pctText(kpis.budgetAttainmentPct),
      subvalue: deltaText(calcDelta(kpis.invoiced, kpis.prevInvoiced), against),
      variant: budgetStatus.variant,
      status: budgetStatus.statusIcon
        ? { icon: budgetStatus.statusIcon, label: budgetStatus.statusLabel }
        : undefined,
      to: "../invoicing",
      filter: tabFilter,
      metrics: [
        {
          label: "Revenue Budget",
          value: kpis.budget == null ? "none set" : preciseCurrency(kpis.budget),
          to: "/app/sales/orders/budgets",
          filter: { ...repFilter },
        },
        lastYearMetric(meta, kpis.invoiced, kpis.lastYearInvoiced, preciseCurrency),
      ],
      title:
        "A/R invoices in the period, not cancelled, including tax, against the " +
        "Revenue Budget for the same days. " +
        "Colour: Critical below 70% of budget, Watch 70–94%, On track at 95%+.",
    },
    {
      icon: WalletIcon,
      label: "Payments Collected",
      sublabel: period.title,
      value: preciseCurrency(kpis.collected),
      subvalue: deltaText(calcDelta(kpis.collected, kpis.prevCollected), against),
      variant: "blueCard",
      to: "../collections",
      filter: tabFilter,
      metrics: [
        { label: "Payments", value: kpis.paymentCount ?? 0 },
        lastYearMetric(meta, kpis.collected, kpis.lastYearCollected, preciseCurrency),
      ],
      title:
        "Payments received in the period and applied to a customer invoice. " +
        "Deposits and unapplied payments are excluded. Payments counts receipts.",
    },
  ];

  // ── Fiscal Year Progress ────────────────────────────────────────────────
  const fy = data?.fyProgress ?? {};
  const fyLabel = fy.fyStart
    ? `FY ${fy.fyStart.slice(0, 4)}-${Number(fy.fyStart.slice(0, 4)) + 1}`
    : "";
  const fytdStatus = getStatusVariant(fy.fytdAttainmentPct ?? null, {
    direction: "high-good",
    thresholds: BUDGET_THRESHOLDS,
  });
  // On pace when the monthly average so far already covers what is needed.
  // No red tier: needing more than the average is a pace to pick up, not a
  // verdict on its own.
  const onPace =
    fy.monthlyNeeded != null && fy.monthlyAverage != null
      ? fy.monthlyNeeded <= fy.monthlyAverage
      : null;

  const fyProgressKpis = [
    {
      icon: CalendarCheckIcon,
      label: "Invoiced Revenue — FY to Date",
      sublabel: fy.asOf ? `${fyLabel} · to ${formatDay(fy.asOf)}` : fyLabel,
      value: preciseCurrency(fy.fytdInvoiced),
      delta: pctText(fy.fytdAttainmentPct),
      variant: fytdStatus.variant,
      status: fytdStatus.statusIcon
        ? { icon: fytdStatus.statusIcon, label: fytdStatus.statusLabel }
        : undefined,
      to: "../invoicing",
      filter: { ...tabFilter, startDate: fy.fyStart, endDate: fy.asOf },
      metrics: [
        {
          label: "Revenue Budget — FY to Date",
          value: fy.fytdBudget == null ? "none set" : preciseCurrency(fy.fytdBudget),
        },
        {
          label: "Revenue Budget — Full FY",
          value: fy.fyBudget == null ? "none set" : preciseCurrency(fy.fyBudget),
        },
      ],
      title:
        "Invoiced revenue from the start of the fiscal year to the end of the selected " +
        "period (or today, whichever is earlier), against the Revenue Budget for the " +
        "same days. Colour: Critical below 70%, Watch 70–94%, On track at 95%+.",
    },
    {
      icon: SpeedometerIcon,
      label: "Monthly Invoicing Needed",
      sublabel:
        fy.monthsLeft > 0
          ? `${fyLabel} · ${Math.round(fy.monthsLeft * 10) / 10} month(s) left`
          : `${fyLabel} · no months left`,
      value: fy.monthlyNeeded == null ? "—" : preciseCurrency(fy.monthlyNeeded),
      ...paceTileStatus(onPace),
      to: null,
      metrics: [
        {
          label: "Monthly Average So Far",
          value: fy.monthlyAverage == null ? "—" : preciseCurrency(fy.monthlyAverage),
        },
        {
          label: "Budget Remaining",
          value: fy.budgetRemaining == null ? "—" : preciseCurrency(fy.budgetRemaining),
        },
      ],
      title:
        "What still has to be invoiced each month, for the rest of the fiscal year, " +
        "to reach the full-year Revenue Budget (part-months count by their days). " +
        "Green when the monthly average so far already covers it, amber when it " +
        "needs a faster pace.",
    },
    ...projectionTiles,
  ];

  const fyCumulative = shapeTrendRows(
    data?.fyCumulative ?? [],
    (d) => formatMonthTick(d.period),
    (d) => ({ "Invoiced Revenue": d.invoiced, "Revenue Budget": d.budget }),
  );

  // ── Open Position (today) ───────────────────────────────────────────────
  const op = data?.openPosition ?? {};
  const openPositionKpis = [
    todayTile({
      icon: FunnelIcon,
      label: "Active Pipeline",
      value: preciseCurrency(op.activePipeline),
      variant: "blueCard",
      to: "../pipeline",
      filter: tabFilter,
      metrics: [
        { label: "Weighted", value: preciseCurrency(op.weightedPipeline) },
        {
          label: "Pipeline Coverage",
          value: op.pipelineCoverage == null ? "—" : `${op.pipelineCoverage}×`,
        },
      ],
      title:
        "Expected revenue of every open lead right now; Pipeline Coverage compares it " +
        "with the Pipeline Target left this fiscal year. Same figures as on Pipeline.",
    }),
    todayTile({
      icon: PackageIcon,
      label: "Open Backlog",
      value: preciseCurrency(op.openBacklog),
      variant: "blueCard",
      to: "../orders",
      filter: tabFilter,
      metrics: [
        { label: "Orders", value: op.openBacklogOrders ?? 0 },
        {
          label: "Open Backlog (Months)",
          value: op.openBacklogMonths == null ? "—" : `${op.openBacklogMonths}`,
        },
      ],
      title:
        "Sales orders open in SAP and not fully delivered, right now, and how many " +
        "months of invoicing that is at the recent pace. Same figures as on Orders.",
    }),
    todayTile({
      icon: HourglassMediumIcon,
      label: "Outstanding Invoices",
      value: preciseCurrency(op.outstanding),
      variant: "blueCard",
      to: "../collections",
      filter: tabFilter,
      metrics: [
        { label: "Overdue", value: preciseCurrency(op.overdue) },
        { label: "Critically Overdue (90+ days)", value: preciseCurrency(op.criticallyOverdue) },
      ],
      title:
        "What customers owe right now on invoices open in SAP (Finance's rule), and how " +
        "much of it is past due. Same figures as on Collections.",
    }),
  ];

  const yoy = shapeTrendRows(
    data?.orderToCashYoY ?? [],
    (d) => d.name,
    (d) => ({
      won: d.won,
      booked: d.booked,
      invoiced: d.invoiced,
      collected: d.collected,
    }),
  );

  const bridge = buildBudgetBridge(data?.budgetBridge ?? []);

  const projectionNote = (
    <p className="textXXS textLight">
      <GlobeHemisphereEastIcon size={14} /> The projections are company-wide, so
      they are hidden while a salesperson is picked —{" "}
      <Link to={{ pathname: "../forecast", search }}>see Forecast</Link>.
    </p>
  );

  return (
    <TabState
      isLoading={isLoading}
      isUpdating={isUpdating || projectionsUpdating}
      error={error}
    >
      <MappingMissingNote meta={meta} />

      {/* PARKED 2026-10-23: AI Meeting Brief, not deployed (see the import above).
      <MeetingBrief filters={filters} period={period} /> */}

      <ReportSection
        icon={ChartLineUpIcon}
        title="Sales KPIs"
        description={`${period.title}, pipeline to payment. Each tile opens its tab.`}
      >
        <OverviewCards items={salesKpis} />
      </ReportSection>

      <ReportSection
        icon={CalendarCheckIcon}
        title="Fiscal Year Progress"
        description={
          repPicked
            ? `${fyLabel} to date against the Revenue Budget, and what is still needed.`
            : `${fyLabel} to date against the Revenue Budget, what is still needed, and the company-wide projection.`
        }
      >
        <OverviewCards items={fyProgressKpis} />
        {repPicked && projectionNote}

        <CardLayout>
          <ChartCard
            title="Cumulative Invoiced Revenue vs Budget (RM)"
            subtitle={[
              `${fyLabel}, running total by month`,
              fyCumulative.highlight && `${period.title} shaded`,
              fyCumulative.hasPartial && "* month to date",
            ]
              .filter(Boolean)
              .join(" · ")}
            style="cardGapSmall"
          >
            <LineChartRenderer
              data={fyCumulative.data}
              highlight={fyCumulative.highlight}
              lines={[
                { dataKey: "Invoiced Revenue", color: MEASURE_COLORS.invoicedRevenue },
                { dataKey: "Revenue Budget", color: MEASURE_COLORS.plan, dashed: true },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>

      <ReportSection
        icon={ScalesIcon}
        title="Budget Variance"
        description={`${period.title}, from Revenue Budget to Invoiced Revenue: each rep's shortfall, the reps at or above budget, and invoicing with no budget set.`}
      >
        {repPicked ? (
          <p className="textXXS textLight">
            The budget bridge compares reps, so it is hidden while one salesperson is
            picked. Their budget gap is on the Invoiced Revenue tile above.
          </p>
        ) : (
          <CardLayout>
            <ChartCard
              title="Where the Budget Gap Came From (RM)"
              subtitle={`Revenue Budget → each rep's shortfall → Invoiced Revenue, ${period.title}`}
              style="cardGapSmall"
            >
              {bridge.length > 0 ? (
                <BridgeChartRenderer data={bridge} endColor={MEASURE_COLORS.invoicedRevenue} />
              ) : (
                <NoResult title="No budget or invoicing for this period." />
              )}
            </ChartCard>
          </CardLayout>
        )}
      </ReportSection>

      <ReportSection
        icon={HourglassMediumIcon}
        title="Open Position"
        description="Today, whatever period is picked: the open pipeline, the open order backlog, and what customers still owe. Each tile opens its tab."
      >
        <OverviewCards items={openPositionKpis} />
      </ReportSection>

      <ReportSection
        icon={ChartLineUpIcon}
        title="Order-to-Cash — Year over Year"
        description="Pipeline Won, Sales Orders, Invoiced Revenue and Payments Collected per fiscal year."
      >
        <CardLayout>
          <ChartCard
            title="Order-to-Cash — Year over Year (RM)"
            subtitle={[
              "Last 10 fiscal years, not affected by the period",
              "Pipeline Won from the year the CRM started",
              yoy.highlight && "selected fiscal year shaded",
              yoy.hasPartial && "* year to date",
            ]
              .filter(Boolean)
              .join(" · ")}
            style="cardGapSmall"
          >
            <VerticalMultiBarRenderer
              data={yoy.data}
              highlight={yoy.highlight}
              bars={[
                { dataKey: "won", name: "Pipeline Won", color: MEASURE_COLORS.pipelineWon },
                { dataKey: "booked", name: "Sales Orders", color: MEASURE_COLORS.salesOrders },
                { dataKey: "invoiced", name: "Invoiced Revenue", color: MEASURE_COLORS.invoicedRevenue },
                { dataKey: "collected", name: "Payments Collected", color: MEASURE_COLORS.paymentsCollected },
              ]}
            />
          </ChartCard>
        </CardLayout>
      </ReportSection>
    </TabState>
  );
}
