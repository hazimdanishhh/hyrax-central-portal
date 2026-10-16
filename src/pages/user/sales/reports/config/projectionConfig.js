import {
  TrendUpIcon,
  CalendarBlankIcon,
  GaugeIcon,
  WarningIcon,
  TargetIcon,
} from "@phosphor-icons/react";
import {
  compactCurrency,
  preciseCurrencyWithCents,
} from "../../../../../functions/formatNumber";
import { getStatusVariant } from "../../../../../functions/statusVariant";

/**
 * Projection KPI tiles for Sales Reports.
 *
 * ── ONE CLOCK, AS OF 2026-10-16 ───────────────────────────────────────────
 *
 * Until today this file read TWO RPCs. Tiles 1-3 came from a function that
 * took no arguments and always described *now*; tile 4 came from one that
 * followed the section's year dropdown. Choosing FY 2024-2025 left three
 * tiles still talking about November 2026.
 *
 * get_sales_projections(p_fiscal_year_start) now answers all four, so `kpis`
 * is a single nested object -- { year, month, reliability, health } -- and
 * every figure on this page describes the year in the dropdown.
 *
 * ── THE SECOND ARGUMENT IS THE CLICKED MONTH ──────────────────────────────
 *
 * `selectedRow` is one row of monthlyData: whichever month is selected on the
 * main chart. Tile 2 is built entirely from it, which is why clicking a month
 * costs no refetch and the tile can never disagree with the chart it was
 * clicked on.
 *
 * ── WHAT IS BEING FORECAST: INVOICED REVENUE ──────────────────────────────
 *
 * Every figure here projects INVOICED revenue -- `sap_invoices`, the same
 * measure as this page's own "Invoiced Revenue vs Budget" tile. It does NOT
 * project orders. The order book (`sap_sales_orders`) is an INPUT to the
 * forecast, not its subject: the chain-ladder develops orders already placed
 * into the invoicing they are expected to produce.
 *
 * ── SLOT 3 CHANGES WITH THE YEAR, AND IS SOMETIMES ABSENT ─────────────────
 *
 * "This month, live" only exists in the year that contains today. A closed
 * year has no month in progress, so the slot carries that year's biggest miss
 * instead -- the month we got most wrong, which is the question a review of a
 * closed year actually opens with. A FUTURE year has neither, and the slot is
 * omitted rather than filled with em-dashes.
 *
 *   FY contains today  ->  FY total | Selected month | This month | Reliability
 *   Past FY            ->  FY total | Selected month | Biggest miss | Reliability
 *   Future FY          ->  FY total | Selected month | Reliability
 *
 * ── TWO TILES CARRY THE SEVERITY RAMP, AND TWO DO NOT ─────────────────────
 *
 * §4: a tile earns the green/amber/red ramp only with BOTH an inherent
 * direction of "better" AND a comparator already in `kpis`.
 *
 *   Tile 1 EARNS IT -- it has a budget to be measured against, and beating
 *   plan is unambiguously good. Before the budget existed this was
 *   informational blue and correctly so: revenue above forecast is not
 *   "good", it means the forecast was low.
 *
 *   Tile 4 EARNS IT -- a smaller miss is unambiguously better.
 *
 *   Slots 2 and 3 do NOT. A month's forecast has no good direction, and a
 *   single month's miss is already judged by tile 4's ramp -- two red tiles
 *   for one verdict would double-count it.
 */

const pct = (v) => (v == null ? null : `${v > 0 ? "+" : ""}${v}%`);

const money = (v) => (v == null ? "—" : preciseCurrencyWithCents(v));

const range = (lo, hi) =>
  lo == null || hi == null
    ? null
    : `${compactCurrency(lo)} – ${compactCurrency(hi)}`;

export function getSalesProjectionsConfig(kpis, selectedRow) {
  if (!kpis?.year) return [];

  const y = kpis.year;
  const m = kpis.month || {};
  const r = kpis.reliability || {};
  const h = kpis.health || {};

  const tiles = [];

  // ══ 1. How much this fiscal year, and is it enough? ═════════════════════
  //
  // Thresholds match this page's own "Invoiced Revenue vs Budget" tile
  // (warningAt 70, goodAt 95) on purpose: same question, same bar, so a
  // forecast of 94% attainment and an actual of 94% attainment read the same
  // amber.
  //
  // Null attainment (no budget set for the year) returns blueCard from
  // getStatusVariant on its own -- it never guesses a tier for missing data.
  const budgetStatus = getStatusVariant(y.budgetAttainmentPct, {
    direction: "high-good",
    thresholds: { warningAt: 70, goodAt: 95 },
  });

  // A closed year is not a projection. Saying "Projected" over a figure that
  // is entirely actual would be false, and §3's rule is that two figures which
  // can legitimately differ must both be labelled.
  const yearLabel = y.isPastFiscalYear
    ? `Invoiced Revenue — FY ${y.fiscalYearLabel}`
    : `Projected Invoiced Revenue — FY ${y.fiscalYearLabel}`;

  const yearMetrics = [
    {
      label: "Revenue Budget",
      value: y.budget > 0 ? money(y.budget) : "none set",
    },
  ];

  if (y.isPastFiscalYear) {
    yearMetrics.push(
      { label: "Forecast said", value: money(y.forecastTotalScored) },
      { label: "Year total vs actual", value: pct(y.scoredErrorPct) || "—" },
    );
  } else {
    yearMetrics.push(
      { label: "Invoiced so far", value: money(y.actualToDate) },
      // NOT "Still forecast". This figure includes the current month in full,
      // and part of that month is already banked -- by the 28th it is mostly
      // actual wearing a forecast label. "Not yet closed" is what it actually
      // is.
      {
        label: "Not yet closed",
        value: money((y.currentMonthEstimate || 0) + (y.projectedRemainder || 0)),
      },
      { label: "80% range", value: range(y.lo80, y.hi80) || "—" },
    );
  }

  // The C11 finding, inherited from the retired "Order Book vs Invoicing
  // History" tile: orders rising while invoicing falls means the book is
  // filling with work that is not converting. A delivery signal, not a
  // forecasting one, and the only place it is visible on this page.
  //
  // Null on any year that does not contain today -- it is a trailing-6-month
  // figure describing NOW, and the RPC nulls it rather than let it be read as
  // describing a closed year.
  if (y.ordersYoyPct != null || y.invoicedYoyPct != null) {
    yearMetrics.push(
      { label: "Orders booked, 6m vs last yr", value: pct(y.ordersYoyPct) || "—" },
      { label: "Invoiced, 6m vs last yr", value: pct(y.invoicedYoyPct) || "—" },
    );
  }

  tiles.push({
    icon: TrendUpIcon,
    label: yearLabel,
    // Derived, not hardcoded -- fiscalYearLabel is "2026-2027".
    sublabel: `Apr ${y.fiscalYearLabel?.slice(2, 4) ?? ""} – Mar ${y.fiscalYearLabel?.slice(-2) ?? ""}`,
    value: money(y.outlook),
    subvalue:
      y.budgetAttainmentPct == null
        ? y.vsPriorYearPct == null
          ? null
          : `${pct(y.vsPriorYearPct)} vs FY prior`
        : `${y.budgetAttainmentPct}% of budget`,
    variant: budgetStatus.variant,
    status: budgetStatus.statusIcon
      ? { icon: budgetStatus.statusIcon, label: budgetStatus.statusLabel }
      : undefined,
    to: null,
    metrics: yearMetrics,
    title: y.isPastFiscalYear
      ? "Invoiced revenue for a closed fiscal year (sap_invoices), against the budget. " +
        "Every month is actual — nothing here is forecast. " +
        "'Forecast said' is what the model predicted across the months it scored, so the " +
        "two can differ from the year total if some months were never scored. " +
        "Colour: Critical below 70% of budget, Watch 70–94%, On track at 95%+."
      : "Invoiced revenue expected for the full fiscal year (sap_invoices), against the " +
        "budget. Closed months are actual; the rest is forecast. A year total is far more " +
        "reliable than any single month in it — timing errors cancel over a span. " +
        "This forecasts ATTAINMENT, it is not attainment achieved. " +
        "Colour: Critical below 70% of budget, Watch 70–94%, On track at 95%+. Blue if no " +
        "budget is set.",
  });

  // ══ 2. The selected month ═══════════════════════════════════════════════
  //
  // Follows the chart. Clicking any month re-points this tile and both exhibit
  // charts together, so the three always describe the same month.
  //
  // A CLOSED month is a scored result and a FUTURE one is a forecast. They are
  // different claims and the tile says which -- per §3, never silently pick
  // one shape for both.
  const sel = selectedRow || null;
  const isScored = sel?.segment === "past";
  const isNextMonth =
    sel?.periodMonth != null && sel.periodMonth === m.nextPeriodMonth;

  const selMetrics = [];

  if (isScored) {
    selMetrics.push(
      { label: "Forecast said", value: money(sel.projected) },
      { label: "Miss", value: pct(sel.errorPct) || "—" },
      {
        label: "Landed in the 80% range",
        value: sel.insideBand == null ? "—" : sel.insideBand ? "yes" : "no",
      },
      {
        label:
          sel.source === "recorded"
            ? "As published at the time"
            : "Rebuilt afterwards",
        value: "",
      },
    );
  } else if (isNextMonth) {
    selMetrics.push(
      { label: "vs trailing 3-month average", value: pct(m.nextVsTrailing3mPct) || "—" },
      { label: "vs same month last year", value: pct(m.nextVsLastYearPct) || "—" },
      {
        label: "Already in order book",
        value:
          m.nextOrderBookWeightPct == null
            ? "—"
            : `${m.nextOrderBookWeightPct}% of the estimate`,
      },
      {
        label: "Models disagree",
        value:
          m.nextModelSpreadPct == null ? "—" : `${m.nextModelSpreadPct}% apart`,
      },
    );
  } else if (sel) {
    selMetrics.push(
      {
        label: "Months ahead",
        value: sel.horizon == null ? "—" : `${sel.horizon}`,
      },
      {
        label: "95% range",
        value: sel.band95 ? range(sel.band95[0], sel.band95[1]) || "—" : "—",
      },
    );
  }

  tiles.push({
    icon: CalendarBlankIcon,
    label: isScored
      ? `Forecast vs Actual — ${sel.name}`
      : `Projected Invoiced Revenue — ${sel?.name ?? "—"}`,
    sublabel: isScored
      ? "Closed month"
      : isNextMonth
        ? "Next month"
        : sel?.horizon != null
          ? `${sel.horizon} months ahead`
          : "Selected month",
    value: isScored ? money(sel.actual) : money(sel?.projected),
    // A closed month shows what was forecast; an open one shows the range.
    //
    // "80% likely" rather than "80% range". The claim is identical -- an 80%
    // interval IS an 80% likelihood -- but said this way it reads to someone
    // who has never met a prediction interval. Honest because the coverage is
    // MEASURED at 77-82% across every horizon, not assumed. Tile 4 publishes
    // that measurement. See DASHBOARD-CONVENTIONS.md §3.
    subvalue: isScored
      ? `Forecast ${compactCurrency(sel.projected)}`
      : sel?.band80
        ? `80% likely ${range(sel.band80[0], sel.band80[1])}`
        : null,
    variant: "blueCard",
    to: null,
    metrics: selMetrics,
    title: isScored
      ? "What the model said one month ahead for this month, against what actually came " +
        "in (sap_invoices). Click any month on the chart to move this tile. " +
        "'Rebuilt afterwards' months were reconstructed from the backtest because they " +
        "closed before frozen snapshots existed — a weaker claim than one recorded " +
        "before the outcome was known. " +
        "Blue: a single month's miss has no verdict of its own; Forecast Reliability " +
        "carries that."
      : "Invoiced revenue expected for this month (sap_invoices). Not orders booked. " +
        "Click any month on the chart to move this tile. " +
        "Single months are volatile — the top three invoices are typically 31% of a " +
        "month, so one shipment slipping a few days moves this. The full-year figure is " +
        "the dependable one. " +
        "'80% likely' means four months in five land inside that range; Forecast " +
        "Reliability reports how often that has held. " +
        "Blue: a forecast has no good direction.",
  });

  // ══ 3a. This month, live — only in the year that contains today ═════════
  if (y.isCurrentFiscalYear && m.currentLabel) {
    tiles.push({
      icon: GaugeIcon,
      label: `This Month — ${m.currentLabel}`,
      sublabel:
        m.currentDayElapsed != null && m.currentDaysInMonth != null
          ? `Day ${m.currentDayElapsed} of ${m.currentDaysInMonth}`
          : "In progress",
      value: money(m.currentEstimate),
      subvalue:
        range(m.currentLo80, m.currentHi80) == null
          ? null
          : `80% likely ${range(m.currentLo80, m.currentHi80)}`,
      variant: "blueCard",
      to: null,
      metrics: [
        { label: "Invoiced so far", value: money(m.currentMtdActual) },
        // NULL UNTIL 1 NOVEMBER 2026. The first snapshot was taken by hand on
        // 2026-10-14 and its one-month-ahead target is November, so no frozen
        // forecast for October exists and none can be made after the fact.
        // The row renders an em-dash and starts working on its own.
        {
          label: m.currentPriorForecastFrom
            ? `Forecast made ${m.currentPriorForecastFrom}`
            : "Forecast made last month",
          value: money(m.currentPriorForecast),
        },
        {
          label: "vs that forecast",
          value: pct(m.currentVsPriorForecastPct) || "—",
        },
      ],
      title:
        "Where this month is heading: what has been invoiced so far plus the model's " +
        "run rate for the days left (sap_invoices). " +
        "'Forecast made last month' is the number we published before the month started, " +
        "frozen at the time — not recomputed today knowing how the month has gone. " +
        "It is blank until the first snapshot's target month arrives and cannot be " +
        "backfilled. " +
        "Blue: being above or below a forecast is not itself good or bad.",
    });
  }

  // ══ 3b. The year's biggest miss — a closed year only ════════════════════
  //
  // Ranked on the miss in RINGGIT, not percent: a 60% miss on a RM200k month
  // is noise, a 25% miss on a RM6M month is the one that moved the year.
  else if (m.biggestMissLabel) {
    tiles.push({
      icon: WarningIcon,
      label: `Biggest Miss — FY ${y.fiscalYearLabel}`,
      sublabel: `${m.biggestMissLabel} · closed months`,
      value: pct(m.biggestMissPct) || "—",
      subvalue:
        m.biggestMissProjected == null
          ? null
          : `Forecast ${compactCurrency(m.biggestMissProjected)} · actual ${compactCurrency(m.biggestMissActual)}`,
      variant: "blueCard",
      to: null,
      metrics: [
        { label: "Miss", value: money(m.biggestMissMyr) },
        {
          label: "Landed in the 80% range",
          value:
            m.biggestMissInsideBand == null
              ? "—"
              : m.biggestMissInsideBand
                ? "yes"
                : "no",
        },
        {
          label:
            m.biggestMissSource === "recorded"
              ? "As published at the time"
              : "Rebuilt afterwards",
          value: "",
        },
      ],
      title:
        "The single month of this fiscal year the forecast got most wrong, ranked by the " +
        "miss in ringgit rather than percent — a large miss on a small month is noise. " +
        "A positive figure means the forecast was too high. " +
        "Blue: one month is an observation, not a verdict; Forecast Reliability is the " +
        "verdict.",
    });
  }

  // ══ 4. How much should I trust any of this? ═════════════════════════════
  //
  // FIXED 2026-10-14. This read `{ warningAt: 50, goodAt: 35 }` -- but
  // `goodAt` is a high-good key and low-good reads `criticalAt`. criticalAt
  // was undefined, every `value >= undefined` is false, so the critical tier
  // was dead code: a 45% miss rendered GREEN "On track" and red was
  // unreachable.
  //
  // Anchored on what this series supports: a single month runs ~30% error and
  // seasonal-naive -- the dumbest possible benchmark -- runs ~49%. Beating
  // 35% is good; past 50% the forecast is adding nothing over "last year
  // repeated", which is a failure, not a warning.
  const missStatus = getStatusVariant(r.typicalMissPct, {
    direction: "low-good",
    thresholds: { warningAt: 35, criticalAt: 50 },
  });

  // Stated on the tile that makes accuracy claims, because a year rebuilt
  // after the fact is a weaker claim than one recorded before the outcome was
  // known, and a tile that hides the difference overstates what it knows.
  const evidence =
    r.monthsScored == null || r.monthsScored === 0
      ? "No closed months scored"
      : r.recordedMonths > 0
        ? `${r.recordedMonths} recorded · ${r.reconstructedMonths} rebuilt afterwards`
        : `${r.reconstructedMonths} months, all rebuilt afterwards`;

  tiles.push({
    icon: TargetIcon,
    label: "Forecast Reliability",
    sublabel: `FY ${y.fiscalYearLabel} · closed months`,
    value: r.typicalMissPct == null ? "—" : `${r.typicalMissPct}% typical miss`,
    // Headline is the miss, subvalue is the coverage, and BOTH are needed.
    // Coverage alone can be gamed by a wide enough band; the miss alone says
    // nothing about whether the published range is honest. The miss drives the
    // colour because it is the quality verdict.
    subvalue:
      r.bandCoveragePct == null
        ? null
        : `${r.bandCoveragePct}% landed inside the 80% range`,
    variant: missStatus.variant,
    status: missStatus.statusIcon
      ? { icon: missStatus.statusIcon, label: missStatus.statusLabel }
      : undefined,
    to: null,
    metrics: [
      {
        label: "Typical miss",
        value: money(r.typicalMissMyr),
      },
      {
        label: "Year total vs actual",
        value: pct(y.scoredErrorPct) || "—",
      },
      {
        label: "Band basis",
        value: h.bandBasis === "measured span error" ? "measured" : "assumed",
      },
      { label: evidence, value: "" },
    ],
    title:
      "How far the one-month-ahead forecast has typically landed from actual invoiced " +
      "revenue, for the selected year. It is the average miss in ringgit divided by the " +
      "average month's revenue — not the average of monthly percentages. " +
      "FOR SCALE: assuming last year's same month repeats misses by about 49%. That is " +
      "the bar to clear. " +
      "The second figure is how often actuals landed inside the 80% range. 80% is the " +
      "aim — well above it is also a failure, because a range that is never wrong is too " +
      "wide to be useful. " +
      "'Rebuilt afterwards' months flatter the result: their settings were chosen " +
      "knowing how those months turned out. " +
      "Colour: Critical at 50%+ miss (no better than assuming last year repeats), " +
      "Watch 35–49%, On track below 35%.",
  });

  return tiles;
}
