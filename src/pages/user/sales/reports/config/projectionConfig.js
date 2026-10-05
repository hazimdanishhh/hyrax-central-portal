import {
  TrendUpIcon,
  CalendarBlankIcon,
  ScalesIcon,
  GaugeIcon,
} from "@phosphor-icons/react";
import {
  compactCurrency,
  preciseCurrencyWithCents,
} from "../../../../../functions/formatNumber";
import { getStatusVariant } from "../../../../../functions/statusVariant";

/**
 * Projection KPI tiles for Sales Reports (Phase D).
 *
 * ── WHAT IS BEING FORECAST: INVOICED REVENUE ──────────────────────────────
 *
 * Every figure here projects INVOICED revenue -- `sap_invoices`, the same
 * measure as this page's own "Invoiced Revenue vs Budget" tile. It does NOT
 * project orders.
 *
 * The order book (`sap_sales_orders`) is an INPUT to the forecast, not its
 * subject: the chain-ladder develops orders already placed into the invoicing
 * they are expected to produce. So "Order Book vs Statistical" compares two
 * ways of estimating the SAME invoiced-revenue figure, not orders against
 * invoices.
 *
 * This was ambiguous in the first cut and is the reason every label below now
 * carries the word "Invoiced" or names its source table outright.
 *
 * ── LABELLING CONVENTION ──────────────────────────────────────────────────
 *
 * Per DASHBOARD-CONVENTIONS.md §3/§4b and the shape of this page's own
 * overviewConfig.js: the LABEL carries the canonical source tag ("Sales
 * Orders", "Invoiced Revenue", "Payments Collected"), the SUBLABEL carries the
 * window and nothing else, and every sub-metric label names its literal source
 * table. The tag for this section is **Projection** -- added to the canonical
 * table in DASHBOARD-CONVENTIONS.md §3 -- which exists precisely because
 * "Projected" alone could mean the CRM Target or the SAP Budget, both of which
 * already live on this page and are both set BY A HUMAN. This one is computed.
 *
 * ── WHY THREE OF THE FOUR ARE INFORMATIONAL BLUE ───────────────────────────
 *
 * §4 of DASHBOARD-CONVENTIONS.md: a tile earns the green/amber/red ramp only
 * if it has BOTH an inherent direction of "better" AND a comparator already in
 * `kpis`. A projection has neither -- revenue coming in above forecast is not
 * "good", it means the forecast was low. Tiles 1-3 are therefore fixed blue,
 * tint only, no status badge.
 *
 * Tile 4 is the exception and a genuine verdict: models disagreeing more IS
 * unambiguously worse, and the spread is computable from fields already in
 * `kpis`. It gets the ramp and a badge, so severity is never colour alone.
 *
 * ── WHAT IS NOT HERE ───────────────────────────────────────────────────────
 *
 * The "Projection Accuracy" tile from architecture §9 needs Phase E's frozen
 * snapshots. A live-computed projection rewrites its own history -- last
 * month's forecast for March is a different number this month -- so accuracy
 * measured without snapshots compares against a moving target and would
 * flatter itself indefinitely.
 */
export function getSalesProjectionsConfig(kpis) {
  if (!kpis) return [];

  const pct = (v) => (v == null ? null : `${v > 0 ? "+" : ""}${v}%`);

  // ─── Tile 1: Full-Year Outlook (fiscal April-March) ──────────────────────
  // Leads the section. C19 measured a multi-month total at ~10% error against
  // 32-42% for any single month -- timing noise cancels over a span, so this
  // is the trustworthy number and Next Month is the volatile one.
  const beyond = kpis.fullYearMonthsBeyondValidated || 0;

  // Honest disclosure rather than a footnote nobody reads. From April to July
  // the remaining fiscal year is longer than the six months Phase C could
  // validate (C21), and those months carry visibly wider bands.
  const horizonNote =
    beyond > 0
      ? `${kpis.fullYearMonthsProjected} months projected · ${beyond} beyond validated horizon`
      : `${kpis.fullYearMonthsProjected} months projected · all within validated horizon`;

  // ─── Tile 4: Forecast Confidence ─────────────────────────────────────────
  // Spread between the highest and lowest model, as a share of the published
  // number. "The models agree within 12%" is actionable; "between-model
  // variance is 18% of total" is not. Thresholds are documented estimates, not
  // audited targets -- per §4's closing line.
  const spread = kpis.modelSpreadPct;
  const confidenceStatus = getStatusVariant(spread, {
    direction: "low-good",
    thresholds: { warningAt: 25, goodAt: 45 },
  });

  return [
    {
      icon: TrendUpIcon,
      label: "Projected Invoiced Revenue — Full Year",
      sublabel: `FY ${kpis.fiscalYearLabel}, Apr–Mar · actual + projected`,
      value: preciseCurrencyWithCents(kpis.fullYearOutlook),
      subvalue:
        kpis.fullYearVsPriorPct == null
          ? null
          : `${pct(kpis.fullYearVsPriorPct)} vs FY prior`,
      variant: "blueCard",
      to: null,
      metrics: [
        {
          label: "Invoiced, closed months (sap_invoices)",
          value: compactCurrency(kpis.fullYearActualToDate),
        },
        {
          label: "Current month — invoiced to date + run-rate",
          value: compactCurrency(kpis.fullYearCurrentMonthEstimate),
        },
        {
          label: "Projected invoicing, remaining months",
          value: compactCurrency(kpis.fullYearProjectedRemainder),
        },
        {
          label: "80% range",
          value: `${compactCurrency(kpis.fullYearLo80)} – ${compactCurrency(kpis.fullYearHi80)}`,
        },
        { label: horizonNote, value: "" },
      ],
      title:
        "Projected INVOICED revenue for the fiscal year (April–March) — the same measure as " +
        "this page's 'Invoiced Revenue vs Budget' tile, from sap_invoices. Not orders. " +
        "Closed months are actual invoicing; the current month is what has been invoiced " +
        "so far plus the model's monthly level for the days remaining; the rest is projected. " +
        "A multi-month total is markedly more reliable than any single month in it — timing " +
        "errors (did that large shipment land in March or April?) cancel over a span. " +
        "Informational blue: a projection has no inherently good direction.",
    },

    {
      icon: CalendarBlankIcon,
      label: "Projected Invoiced Revenue — Next Month",
      sublabel: `${kpis.nextMonthLabel} · single month`,
      value: preciseCurrencyWithCents(kpis.nextMonthProjected),
      subvalue:
        kpis.nextMonthVsTrailing3mPct == null
          ? null
          : `${pct(kpis.nextMonthVsTrailing3mPct)} vs trailing 3-month average`,
      variant: "blueCard",
      to: null,
      metrics: [
        {
          label: "80% range",
          value: `${compactCurrency(kpis.nextMonthLo80)} – ${compactCurrency(kpis.nextMonthHi80)}`,
        },
        {
          label: "vs same month last year (sap_invoices)",
          value: pct(kpis.nextMonthVsLastYearPct) || "—",
        },
        {
          label: "Weight on order book (sap_sales_orders)",
          value: `${kpis.nextMonthOrderBookWeightPct}%`,
        },
      ],
      title:
        "Projected INVOICED revenue for next month alone (sap_invoices). Not orders booked. " +
        "Single months are volatile here — the top three invoices are typically 31.2% of a " +
        "month, so one large shipment slipping a few days moves this figure materially. The " +
        "fiscal-year outlook is the more dependable number. " +
        "'Weight on order book' is how much of this estimate comes from orders already " +
        "placed rather than from statistical models; it was measured, not assumed.",
    },

    {
      icon: ScalesIcon,
      label: "Forecast Inputs — Order Book vs Statistical",
      sublabel: `${kpis.nextMonthLabel} · two estimates of the same invoiced revenue`,
      value: preciseCurrencyWithCents(kpis.orderBookGap),
      subvalue:
        kpis.orderBookGapPct == null
          ? null
          : `Order book implies ${pct(kpis.orderBookGapPct)} vs statistical`,
      variant: "blueCard",
      to: null,
      metrics: [
        {
          label: "Implied by order book (sap_sales_orders)",
          value: compactCurrency(kpis.orderBookImplied),
        },
        {
          label: "Implied by invoicing history (sap_invoices)",
          value: compactCurrency(kpis.aprioriImplied),
        },
        {
          label: "Orders booked, last 6m vs prior yr (sap_sales_orders)",
          value: pct(kpis.ordersYoyPct) || "—",
        },
        {
          label: "Invoiced, last 6m vs prior yr (sap_invoices)",
          value: pct(kpis.invoicedYoyPct) || "—",
        },
      ],
      title:
        "Two independent estimates of the SAME figure — next month's invoiced revenue — " +
        "deliberately shown side by side rather than blended away. This is not orders vs " +
        "invoices: both numbers are invoiced-revenue estimates. One develops the orders " +
        "already on the book (sap_sales_orders) into the invoicing they should produce; the " +
        "other extrapolates recent invoicing history (sap_invoices). " +
        "A persistent gap is a conversion and delivery signal, not a forecasting error — " +
        "orders arriving faster than they are being invoiced accumulate as backlog. " +
        "Two figures may legitimately disagree; the convention is to label both sides so " +
        "the difference stays visible.",
    },

    {
      icon: GaugeIcon,
      label: "Forecast Confidence",
      sublabel: `${kpis.nextMonthLabel} · agreement across 4 models`,
      value: spread == null ? "—" : `${spread}% spread`,
      subvalue:
        kpis.modelHighImplied == null
          ? null
          : `${compactCurrency(kpis.modelLowImplied)} – ${compactCurrency(kpis.modelHighImplied)} across models`,
      variant: confidenceStatus.variant,
      status: confidenceStatus.statusIcon
        ? {
            icon: confidenceStatus.statusIcon,
            label: confidenceStatus.statusLabel,
          }
        : undefined,
      to: null,
      metrics: [
        {
          label: "Highest model",
          value: compactCurrency(kpis.modelHighImplied),
        },
        { label: "Lowest model", value: compactCurrency(kpis.modelLowImplied) },
        {
          label: "Disagreement share of total uncertainty",
          value:
            kpis.betweenModelSharePct == null
              ? "—"
              : `${kpis.betweenModelSharePct}%`,
        },
      ],
      title:
        "How far apart the four models are on next month's invoiced revenue, as a share of " +
        "the published number. This is the one projection tile that earns the severity ramp: models " +
        "disagreeing more is unambiguously worse, which gives it the direction a forecast " +
        "itself lacks. " +
        "Wide disagreement does not mean the number is wrong — it means the evidence is " +
        "genuinely mixed and the interval around it deserves more weight than the point.",
    },
  ];
}
