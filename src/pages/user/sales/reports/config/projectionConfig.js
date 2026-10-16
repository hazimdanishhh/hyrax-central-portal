import {
  TrendUpIcon,
  CalendarBlankIcon,
  ScalesIcon,
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
 * ── RESTRUCTURED 2026-10-14: SEVEN TILES TO FOUR ──────────────────────────
 *
 * This section had grown to 7 tiles carrying 22 sub-metric rows across two
 * files -- the exact failure DASHBOARD-CONVENTIONS.md §4a names: "a wall of
 * numbers rather than a story someone can walk through in a department
 * meeting". §4a's own test resolves it: a tile earns its place only if it
 * answers a NEW question, not another angle on a neighbour's.
 *
 * Four questions were actually being asked:
 *
 *   1. How much will we invoice this fiscal year -- and is that enough?
 *   2. How much next month?
 *   3. Are the orders we already hold turning into invoices?
 *   4. How much should I trust any of this?
 *
 * Four tiles, one per question. The old Forecast Confidence, Forecast
 * Accuracy, Range Reliability and Year Total tiles all answered (4) from
 * different angles and are now sub-metric rows inside it. trackRecordConfig.js
 * is deleted; its three tiles live here.
 *
 * ── WHAT IS BEING FORECAST: INVOICED REVENUE ──────────────────────────────
 *
 * Every figure here projects INVOICED revenue -- `sap_invoices`, the same
 * measure as this page's own "Invoiced Revenue vs Budget" tile. It does NOT
 * project orders.
 *
 * The order book (`sap_sales_orders`) is an INPUT to the forecast, not its
 * subject: the chain-ladder develops orders already placed into the invoicing
 * they are expected to produce. So tile 3 compares two ways of estimating the
 * SAME invoiced-revenue figure, not orders against invoices.
 *
 * ── LABELLING CONVENTION ──────────────────────────────────────────────────
 *
 * Per DASHBOARD-CONVENTIONS.md §3/§4b and this page's own overviewConfig.js:
 * the LABEL carries the canonical source tag, the SUBLABEL carries the window
 * and nothing else, and every sub-metric label names its literal source table.
 * The tag for this section is **Projection** -- it exists because "Projected"
 * alone could mean the CRM Target or the SAP Budget, both of which live on
 * this page and are both set BY A HUMAN. This one is computed.
 *
 * ── TWO TILES NOW CARRY THE SEVERITY RAMP, AND TWO DO NOT ─────────────────
 *
 * §4: a tile earns the green/amber/red ramp only with BOTH an inherent
 * direction of "better" AND a comparator already in `kpis`.
 *
 *   Tile 1 EARNS IT, as of 2026-10-14, because it finally has a budget to be
 *   measured against. Beating plan is unambiguously good. Before the budget
 *   existed this was informational blue and correctly so -- revenue above
 *   forecast is not "good", it means the forecast was low.
 *
 *   Tile 4 EARNS IT: a smaller miss is unambiguously better.
 *
 *   Tiles 2 and 3 do NOT. A next-month projection has no good direction, and
 *   a gap between the two estimation methods could mean growth or could mean
 *   non-conversion -- the sign alone does not say which.
 *
 * ── TWO FISCAL YEARS ARE IN PLAY, DELIBERATELY ────────────────────────────
 *
 * Tile 1 reads the CURRENT fiscal year from get_sales_projections, which takes
 * no arguments. Tile 4 reads the SELECTED one from get_sales_projection_
 * accuracy, driven by the section's own year picker. Choose an old year and
 * the two legitimately disagree.
 *
 * Both sublabels therefore say which year they mean, out loud. §3's rule for
 * two figures that can legitimately differ is to "label both sides so the
 * difference is visible", never to silently pick one.
 */

const pct = (v) => (v == null ? null : `${v > 0 ? "+" : ""}${v}%`);

export function getSalesProjectionsConfig(kpis, trackRecord) {
  if (!kpis) return [];

  // ── TILE 1 ───────────────────────────────────────────────────────────────
  // Thresholds match this page's own "Invoiced Revenue vs Budget" tile
  // (warningAt 70, goodAt 95) on purpose: same question, same bar, so a
  // forecast of 94% attainment and an actual of 94% attainment read the same
  // amber. Documented estimates, not audited targets, per §4's closing line.
  //
  // Null attainment (no budget set for the year) returns blueCard from
  // getStatusVariant on its own -- it never guesses a tier for missing data.
  const budgetStatus = getStatusVariant(kpis.fullYearBudgetAttainmentPct, {
    direction: "high-good",
    thresholds: { warningAt: 70, goodAt: 95 },
  });

  const beyond = kpis.fullYearMonthsBeyondValidated || 0;
  const horizonNote =
    beyond > 0
      ? `${kpis.fullYearMonthsProjected} months projected · ${beyond} more than six ahead`
      : `${kpis.fullYearMonthsProjected} months projected · all within six`;

  // ── TILE 4 ───────────────────────────────────────────────────────────────
  // FIXED 2026-10-14. This read `{ warningAt: 50, goodAt: 35 }` -- but
  // `goodAt` is a high-good key and low-good reads `criticalAt`. criticalAt
  // was undefined, every `value >= undefined` is false, so the critical tier
  // was dead code: a 45% miss rendered GREEN "On track" and red was
  // unreachable. The thresholds below are what the old comment always said
  // the intent was.
  //
  // Anchored on what this series supports: a single month runs ~30% error and
  // seasonal-naive -- the dumbest possible benchmark -- runs ~49%. Beating
  // 35% is good; past 50% the forecast is adding nothing over "last year
  // repeated", which is a failure, not a warning.
  const tr = trackRecord || null;
  const missStatus = getStatusVariant(tr?.typicalMissPct, {
    direction: "low-good",
    thresholds: { warningAt: 35, criticalAt: 50 },
  });

  // Stated on the tile that makes accuracy claims, because a year rebuilt
  // after the fact is a weaker claim than one recorded before the outcome was
  // known, and a tile that hides the difference overstates what it knows.
  const evidence = !tr
    ? "No track record loaded"
    : tr.recordedMonths > 0
      ? `${tr.recordedMonths} recorded · ${tr.reconstructedMonths} rebuilt afterwards`
      : `${tr.reconstructedMonths} months, all rebuilt afterwards`;

  return [
    // ══ 1. How much this fiscal year, and is it enough? ═════════════════════
    {
      icon: TrendUpIcon,
      label: `Projected Invoiced Revenue — FY ${kpis.fiscalYearLabel}`,
      // Derived, not hardcoded -- fiscalYearLabel is "2026-2027".
      sublabel: `Apr ${kpis.fiscalYearLabel?.slice(2, 4) ?? ""} – Mar ${kpis.fiscalYearLabel?.slice(-2) ?? ""}`,
      value: preciseCurrencyWithCents(kpis.fullYearOutlook),
      subvalue:
        kpis.fullYearBudgetAttainmentPct == null
          ? kpis.fullYearVsPriorPct == null
            ? null
            : `${pct(kpis.fullYearVsPriorPct)} vs FY prior`
          : `${kpis.fullYearBudgetAttainmentPct}% of budget`,
      variant: budgetStatus.variant,
      status: budgetStatus.statusIcon
        ? { icon: budgetStatus.statusIcon, label: budgetStatus.statusLabel }
        : undefined,
      to: null,
      metrics: [
        {
          label: "Revenue Budget",
          value:
            kpis.fullYearBudget > 0
              ? preciseCurrencyWithCents(kpis.fullYearBudget)
              : "none set",
        },
        {
          label: "Invoiced so far",
          value: preciseCurrencyWithCents(kpis.fullYearActualToDate),
        },
        {
          label: "Still forecast",
          value: preciseCurrencyWithCents(
            (kpis.fullYearCurrentMonthEstimate || 0) +
              (kpis.fullYearProjectedRemainder || 0),
          ),
        },
        {
          label: "80% range",
          value: `${compactCurrency(kpis.fullYearLo80)} – ${compactCurrency(kpis.fullYearHi80)}`,
        },
        // { label: horizonNote, value: "" },
      ],
      title:
        "Invoiced revenue expected for the full fiscal year (sap_invoices), against the " +
        "budget. Closed months are actual; the rest is forecast. A year total is far more " +
        "reliable than any single month in it — timing errors cancel over a span. " +
        "This forecasts ATTAINMENT, it is not attainment achieved. " +
        "Colour: Critical below 70% of budget, Watch 70–94%, On track at 95%+. Blue if no " +
        "budget is set.",
    },

    // ══ 2. How much next month? ═════════════════════════════════════════════
    {
      icon: CalendarBlankIcon,
      label: `Projected Invoiced Revenue — ${kpis.nextMonthLabel}`,
      sublabel: `Next month`,
      value: preciseCurrencyWithCents(kpis.nextMonthProjected),
      // "80% likely" rather than "80% range". The claim is identical -- an 80%
      // interval IS an 80% likelihood -- but said this way it reads to someone
      // who has never met a prediction interval. Honest because the coverage
      // is MEASURED at 77-82% across every horizon, not assumed. Tile 4 is
      // where that measurement is published. See DASHBOARD-CONVENTIONS.md §3.
      subvalue:
        kpis.nextMonthLo80 == null
          ? null
          : `80% likely ${compactCurrency(kpis.nextMonthLo80)} – ${compactCurrency(kpis.nextMonthHi80)}`,
      variant: "blueCard",
      to: null,
      metrics: [
        {
          label: "vs trailing 3-month average",
          value: pct(kpis.nextMonthVsTrailing3mPct) || "—",
        },
        {
          label: "vs same month last year",
          value: pct(kpis.nextMonthVsLastYearPct) || "—",
        },
        {
          label: "Already in order book",
          value:
            kpis.nextMonthOrderBookWeightPct == null
              ? "—"
              : `${kpis.nextMonthOrderBookWeightPct}% of the estimate`,
        },
      ],
      title:
        "Invoiced revenue expected next month (sap_invoices). Not orders booked. " +
        "Single months are volatile — the top three invoices are typically 31% of a month, " +
        "so one shipment slipping a few days moves this. The full-year figure is the " +
        "dependable one. " +
        "'80% likely' means four months in five land inside that range; Forecast " +
        "Reliability reports how often that has held. " +
        "Blue: a forecast has no good direction.",
    },

    // ══ 3. Are the orders we hold turning into invoices? ════════════════════
    {
      icon: ScalesIcon,
      label: "Order Book vs Invoicing History",
      sublabel: `${kpis.nextMonthLabel} · two estimates`,
      value:
        kpis.orderBookGapPct == null
          ? "—"
          : `${Math.abs(kpis.orderBookGapPct)}% apart`,
      subvalue:
        kpis.orderBookImplied == null
          ? null
          : `Order book ${compactCurrency(kpis.orderBookImplied)} · history ${compactCurrency(kpis.aprioriImplied)}`,
      variant: "blueCard",
      to: null,
      metrics: [
        {
          label: "Orders booked, 6m vs last yr",
          value: pct(kpis.ordersYoyPct) || "—",
        },
        {
          label: "Invoiced, 6m vs last yr",
          value: pct(kpis.invoicedYoyPct) || "—",
        },
      ],
      title:
        "Two ways of estimating the SAME figure — next month's invoiced revenue. One " +
        "develops orders already placed; the other extrapolates invoicing history. " +
        "Not orders vs invoices: both are invoiced-revenue estimates. " +
        "The two percentages below matter most. Orders rising while invoicing falls means " +
        "the book is filling with work that is not converting — a delivery signal, not a " +
        "forecasting error. " +
        "Blue: a gap can mean growth or non-conversion, and the sign alone does not say.",
    },

    // ══ 4. How much should I trust any of this? ═════════════════════════════
    {
      icon: TargetIcon,
      label: "Forecast Reliability",
      sublabel: tr
        ? `FY ${tr.fiscalYearLabel} · closed months`
        : "Closed months",
      value:
        tr?.typicalMissPct == null ? "—" : `${tr.typicalMissPct}% typical miss`,
      // Headline is the miss, subvalue is the coverage, and BOTH are needed.
      // Coverage alone can be gamed by a wide enough band; the miss alone says
      // nothing about whether the published range is honest. The miss drives
      // the colour because it is the quality verdict.
      subvalue:
        tr?.bandCoveragePct == null
          ? null
          : `${tr.bandCoveragePct}% landed inside the 80% range`,
      variant: missStatus.variant,
      status: missStatus.statusIcon
        ? { icon: missStatus.statusIcon, label: missStatus.statusLabel }
        : undefined,
      to: null,
      metrics: [
        {
          label: "Typical miss",
          value:
            tr?.typicalMissMyr == null
              ? "—"
              : compactCurrency(tr.typicalMissMyr),
        },
        {
          label: "Year total vs actual",
          value:
            tr?.yearErrorPct == null
              ? "—"
              : `${tr.yearErrorPct > 0 ? "+" : ""}${tr.yearErrorPct}%`,
        },
        // Forward-looking, inside a backward-looking tile. §4b allows a tile's
        // sub-metrics to mix time-window families as long as each row's own
        // label makes which one unambiguous -- so this one names the month.
        {
          label: `Models disagree, ${kpis.nextMonthLabel}`,
          value:
            kpis.modelSpreadPct == null ? "—" : `${kpis.modelSpreadPct}% apart`,
        },
        { label: evidence, value: "" },
      ],
      title:
        "How far the one-month-ahead forecast has typically landed from actual invoiced " +
        "revenue, for the selected year. FOR SCALE: assuming last year's same month " +
        "repeats misses by about 49%. That is the bar to clear. " +
        "The second figure is how often actuals landed inside the 80% range. 80% is the " +
        "aim — well above it is also a failure, because a range that is never wrong is " +
        "too wide to be useful. " +
        "'Rebuilt afterwards' months flatter the result: their settings were chosen " +
        "knowing how those months turned out. " +
        "This tile follows the year picker; the full-year tile always shows the current " +
        "year, so the two can name different years. " +
        "Colour: Critical at 50%+ miss (no better than assuming last year repeats), " +
        "Watch 35–49%, On track below 35%.",
    },
  ];
}
