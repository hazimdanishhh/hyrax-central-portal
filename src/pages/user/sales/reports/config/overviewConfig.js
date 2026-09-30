import {
  GaugeIcon,
  ReceiptIcon,
  FileTextIcon,
  UsersThreeIcon,
  PackageIcon,
  StackIcon,
  WalletIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import {
  compactCurrency,
  preciseCurrencyWithCents,
} from "../../../../../functions/formatNumber";
import { getStatusVariant } from "../../../../../functions/statusVariant";

/**
 * KPI-cards restructuring (2026-09-30, see docs/portal/DASHBOARD-CONVENTIONS.md
 * §4b/§4c and get_attendance_dashboard_rpc.sql for the reference convention
 * this migrates onto, plus get_sales_reports_dashboard_rpc.sql's own header
 * comment for the full rationale) -- rethought from first principles around
 * what salespeople/sales managers/executives actually need, not a mechanical
 * consolidation. 8 cards, replacing the prior 8 -- the 4 old Leads/Pipeline
 * tiles (Leads VS Target, Leads Pipeline Health, Leads Win Rate, Sales Leads
 * Cycle) fold into ONE "Leads vs Target" card; Customer Concentration gains
 * two siblings (Product/Product Group Concentration); a new ACTIONABLE
 * "Sales Order Health" card closes a real gap (nothing on this page
 * previously surfaced overdue deliveries/payment mismatches/unbilled
 * orders). Charts are a deliberately separate, later pass -- untouched here
 * except where a chart-feeding RPC field's own default period shifted
 * (documented per-field in the RPC).
 *
 * Every REGULAR card below defaults to "This Month" (the FULL calendar
 * month, never month-to-date) when no date range is picked, and reads "This
 * Period" once one is -- computed once as `periodLabel` and reused
 * everywhere, same convention as Attendance/Employee Overview. Card 8 is
 * ACTIONABLE: defaults to the true current backlog (unbounded), and narrows
 * to "originated this period" once a range is picked -- see
 * `actionableLabel` below.
 *
 * Subvalue convention (per explicit product correction during planning):
 * a tile that already shows an attainment/rate percentage KEEPS it -- the
 * previous-period delta is appended into that SAME string via `pctWithDelta`
 * below (e.g. "87% (↑5% vs last month)"), never a separate slot. Sales
 * Orders has no natural percentage to attach to, so its subvalue is just the
 * plain delta.
 *
 * Rep Funnel Scorecard (`invoiceBudgetScorecardData`/`ScorecardList`) is
 * confirmed good and untouched by this pass -- only its own underlying CTEs'
 * default time window shifted to This Month (see the RPC).
 *
 * `topInvoicedCustomers`/`topInvoicedProducts`/`productGroups` are the RPC's
 * topInvoicedCustomersData/topProductsData/revenueByProductGroupData arrays
 * (raw, unmapped for charts) -- reused here ONLY to build each concentration
 * card's own drill-through filter (the specific customer/product codes to
 * link to); the tile's own headline/percentage values come from the RPC's
 * `kpis.*ConcentrationPct` fields directly, computed from the exact same
 * window server-side, so the display number can never drift from what these
 * arrays would independently compute.
 *
 * Source-labeling convention (see DASHBOARD-CONVENTIONS.md): "Customer" (SAP
 * customer_code) is kept distinct from "Client" (the CRM-native `clients`
 * table, used only by the still-deferred "Top Clients" chart) -- this page
 * legitimately uses both words, one per source table.
 *
 * Drill-through: `filters` is this page's own active Owner/Product
 * Type/period filters. `canAccessInvoices`/`canAccessPayments` mirror
 * `canAccessOrders` (computed in Reports.jsx) -- every cross-page link
 * degrades to `to: null` for a viewer who can't actually open the target.
 * Owner/Product Type only ever thread into the CRM-side card (Leads vs
 * Target) -- confirmed via the RPC that they scope base_leads only, with
 * zero effect on any SAP-sourced KPI.
 */
export function getSalesReportsOverviewConfig(
  kpis,
  topInvoicedCustomers = [],
  topInvoicedProducts = [],
  productGroups = [],
  canAccessOrders = false,
  canAccessInvoices = false,
  canAccessPayments = false,
  filters = {},
) {
  const calcDelta = (current, previous) => {
    if (previous === null || previous === undefined) return null;
    if (previous === 0 && current === 0) return 0;
    if (previous === 0 && current > 0) return 100;

    return Math.round(((current - previous) / previous) * 100);
  };

  const deltaText = (delta) =>
    delta === null ? "" : delta > 0 ? `↑ ${delta}%` : `↓ ${Math.abs(delta)}%`;

  // Appends a period-over-period delta into an existing attainment/rate
  // subvalue, rather than replacing it -- see this file's own header comment.
  const pctWithDelta = (pct, delta) => {
    const base = `${pct ?? 0}%`;
    return delta === null
      ? base
      : `${base} (${deltaText(delta)} vs last period)`;
  };

  const isPeriodFiltered =
    Boolean(filters?.startDate) && Boolean(filters?.endDate);
  // REGULAR family's subtitle vocabulary -- same as Attendance/Employee
  // Overview's own periodLabel.
  const periodLabel = isPeriodFiltered ? "This Period" : "This Month";
  // ACTIONABLE family's subtitle vocabulary (Card 8) -- "current backlog"
  // when unfiltered, narrows to "this period" once a range is picked.
  const actionableLabel = isPeriodFiltered ? "This Period" : "Current Backlog";

  // FIXED 2026-09-30: every REGULAR card's drill-through link must reproduce
  // the EXACT window the tile itself is showing -- when no date range is
  // picked, that window is "This Month" (the RPC's own v_effective_start_
  // date/v_effective_end_date default, full calendar month, never month-to-
  // date), not "no date filter at all." Previously periodFilter/
  // closedPeriodFilter fell back to {} when unfiltered, so clicking through
  // an unfiltered tile silently showed ALL-TIME data on the list page --
  // a real mismatch against what the tile displayed. Computed once here so
  // every REGULAR card/metric below stays in sync with the RPC's default.
  const now = new Date();
  const defaultMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const defaultMonthEnd = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfMonth.getDate()).padStart(2, "0")}`;

  // created_at/invoice_date/order_date/payment_date window -- universal
  // across every SAP-sourced REGULAR card below.
  const periodFilter = isPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : { startDate: defaultMonthStart, endDate: defaultMonthEnd };
  // closed_date window (Sales Leads' view-only column) -- backs the
  // CRM-side Leads vs Target card, windowed by when a deal closed.
  const closedPeriodFilter = isPeriodFiltered
    ? { closedDateFrom: filters.startDate, closedDateTo: filters.endDate }
    : { closedDateFrom: defaultMonthStart, closedDateTo: defaultMonthEnd };
  // ACTIONABLE family (Card 8 only) -- deliberately NOT defaulted to This
  // Month: an unfiltered actionable tile means "the true current backlog,"
  // so its own drill-through must stay unbounded too, not silently narrow to
  // this month the way the REGULAR periodFilter above now does.
  const actionablePeriodFilter = isPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : {};
  // CRM-side filters only -- Owner/Product Type never thread into SAP tiles
  // (see header comment).
  const baseFilterCRM = {
    ...(filters.owner && { owner: filters.owner }),
    ...(filters.productType && { productType: filters.productType }),
  };
  // FIXED 2026-09-30: the RPC's own v_sales_rep_code resolution (see its
  // access-guard comment) DOES scope every SAP-sourced KPI on this page
  // (Sales Orders, Invoiced Revenue, Customer Concentration, Sales Order
  // Health) by the selected Salesperson -- this file's own header comment
  // above ("Owner/Product Type only ever thread into the CRM-side card...
  // zero effect on any SAP-sourced KPI") predates that RPC fix and is now
  // wrong. kpis.resolvedSalesRepCode is the RPC's already-resolved mapping
  // (never re-derived here), so every SAP-side link below carries the SAME
  // active Salesperson scope the number itself was computed under. Omitted
  // entirely when no owner is selected -- never sent as a literal "null"
  // filter value. Sales Orders/Invoices both key on "salesRepCode"
  // (fulfillmentOrdersService.js / invoicesService.js, confirmed); Payments
  // (paymentsService.js) has NO sales-rep filter at all today, so Payments
  // Collected's own link below is a real, currently-unfixable gap -- flagged
  // there rather than silently left inconsistent.
  const baseFilterSAP = {
    ...(kpis.resolvedSalesRepCode !== null &&
      kpis.resolvedSalesRepCode !== undefined && {
        salesRepCode: kpis.resolvedSalesRepCode,
      }),
  };

  // ─── Card 1: Leads vs Target ───────────────────────────────────────────
  const pipelineAttainmentDelta = calcDelta(
    kpis.pipelineAttainmentPct,
    kpis.prevPipelineAttainmentPct,
  );
  const pipelineAttainmentStatus = getStatusVariant(
    kpis.pipelineAttainmentPct || 0,
    { direction: "high-good", thresholds: { warningAt: 80, goodAt: 100 } },
  );

  // ─── Card 2: Sales Orders ───────────────────────────────────────────────
  const orderBookDelta = calcDelta(
    kpis.orderBookValue,
    kpis.prevOrderBookValue,
  );

  // ─── Card 3: Invoiced Revenue ───────────────────────────────────────────
  const budgetAttainmentDelta = calcDelta(
    kpis.budgetAttainmentPct,
    kpis.prevBudgetAttainmentPct,
  );
  const invoiceBudgetStatus = getStatusVariant(kpis.budgetAttainmentPct || 0, {
    direction: "high-good",
    thresholds: { warningAt: 80, goodAt: 100 },
  });

  // ─── Card 4: Payments Collected ─────────────────────────────────────────
  // FIXED 2026-09-30 (see the RPC's own header comment, finding #1):
  // kpis.totalCollected now excludes cash not resolved against a real sales
  // invoice -- no separate "Unattributed Cash" metric is shown anywhere on
  // this page, that's Finance's own reconciliation concern.
  const collectionRateDelta = calcDelta(
    kpis.collectionRatePct,
    kpis.prevCollectionRatePct,
  );
  // Same 70/90 collection-rate band as Finance Reports' Cash Collected --
  // same RCT2 chain, must read the same on both dashboards.
  const paymentsCollectedStatus = getStatusVariant(
    kpis.collectionRatePct || 0,
    { direction: "high-good", thresholds: { warningAt: 70, goodAt: 90 } },
  );

  // ─── Cards 5-7: Concentration ───────────────────────────────────────────
  // Values come from kpis.*ConcentrationPct (RPC-computed, exact) -- these
  // arrays are only used to build each tile's own drill-through filter.
  // null (not 0) renders "—" -- getStatusVariant treats null as neutral, not
  // a guessed "good."
  const top5Invoiced = [...topInvoicedCustomers]
    .sort((a, b) => (b.revenue_myr || 0) - (a.revenue_myr || 0))
    .slice(0, 5);
  const top5Products = [...topInvoicedProducts]
    .sort((a, b) => (b.revenue_myr || 0) - (a.revenue_myr || 0))
    .slice(0, 5);
  const top3Groups = [...productGroups]
    .sort((a, b) => (b.revenue_myr || 0) - (a.revenue_myr || 0))
    .slice(0, 3);

  const customerConcentrationStatus = getStatusVariant(
    kpis.customerConcentrationPct,
    { direction: "low-good", thresholds: { warningAt: 30, criticalAt: 60 } },
  );
  const productConcentrationStatus = getStatusVariant(
    kpis.productConcentrationPct,
    { direction: "low-good", thresholds: { warningAt: 30, criticalAt: 60 } },
  );
  // Only ~13 product groups exist company-wide, so top-3 naturally runs
  // higher than a top-5-of-many share -- looser thresholds than
  // Customer/Product Concentration, not the same band copy-pasted.
  const productGroupConcentrationStatus = getStatusVariant(
    kpis.productGroupConcentrationPct,
    { direction: "low-good", thresholds: { warningAt: 40, criticalAt: 70 } },
  );

  // ─── Card 8: Sales Order Health (new, ACTIONABLE) ──────────────────────
  // isCancelled/deliveryOverdueOnly/deliveryDueSoonOnly/hasMismatchOnly/
  // invoicedOnly are the Sales Orders list page's own real, already-verified
  // filter keys (fulfillmentOrdersService.js) -- see
  // src/pages/user/sales/orders/filterConfig.js and overviewConfig.js for
  // the reference usage this mirrors.
  const overdueDeliveryFilter = {
    ...baseFilterSAP,
    isCancelled: "N",
    deliveryOverdueOnly: "true",
    ...actionablePeriodFilter,
  };
  const deliveryDueSoonFilter = {
    ...baseFilterSAP,
    isCancelled: "N",
    deliveryDueSoonOnly: "true",
    ...actionablePeriodFilter,
  };
  const paymentMismatchFilter = {
    ...baseFilterSAP,
    isCancelled: "N",
    hasMismatchOnly: "true",
    ...actionablePeriodFilter,
  };
  const notYetInvoicedFilter = {
    ...baseFilterSAP,
    isCancelled: "N",
    invoicedOnly: "none",
    ...actionablePeriodFilter,
  };
  const salesOrderHealthSeverity =
    (kpis.overdueDeliveriesCount || 0) > 0
      ? 2
      : (kpis.deliveryDueSoonCount || 0) +
            (kpis.paymentMismatchesCount || 0) +
            (kpis.notYetInvoicedCount || 0) >
          0
        ? 1
        : 0;
  const salesOrderHealthStatus = getStatusVariant(salesOrderHealthSeverity, {
    direction: "low-good",
    thresholds: { warningAt: 1, criticalAt: 2 },
  });

  return [
    // TILE 1: Leads vs Target -- consolidates the previous Leads VS Target,
    // Leads Pipeline Health, Leads Win Rate, and Sales Leads Cycle tiles into
    // one card. Active Pipeline Value is a live, point-in-time SNAPSHOT --
    // it deliberately ignores the date filter, same as before.
    {
      icon: GaugeIcon,
      label: "Leads vs Target",
      sublabel: periodLabel,
      value: preciseCurrencyWithCents(kpis.pipelineWonRevenue),
      subvalue: pctWithDelta(
        kpis.pipelineAttainmentPct,
        pipelineAttainmentDelta,
      ),
      variant: pipelineAttainmentStatus.variant,
      status: {
        icon: pipelineAttainmentStatus.statusIcon,
        label: pipelineAttainmentStatus.statusLabel,
      },
      to: "../leads/list",
      filter: { ...baseFilterCRM, stage: "WON", ...closedPeriodFilter },
      metrics: [
        {
          label: "Pipeline Target",
          value: preciseCurrencyWithCents(kpis.pipelineTargetRevenue),
          to: "/app/sales/leads/targets",
          // Targets Management's own filterConfig.js supports "owner" (Sales
          // Rep) -- previously this link carried no filter at all, so
          // selecting a Salesperson on this page didn't carry through.
          filter: { ...baseFilterCRM },
        },
        {
          label: "Win Rate",
          value: `${kpis.winRatePct || 0}%`,
          to: "../leads/list",
          filter: {
            ...baseFilterCRM,
            closedOnly: "true",
            ...closedPeriodFilter,
          },
        },
        {
          label: "Active Pipeline Value",
          value: compactCurrency(kpis.activePipelineValue),
          to: "../leads/list",
          filter: { ...baseFilterCRM, activePipelineOnly: "true" },
        },
        {
          label: "Pipeline Cycle",
          value: `${kpis.avgDaysToClose || 0}d`,
          to: "../leads/list",
          filter: { ...baseFilterCRM, stage: "WON", ...closedPeriodFilter },
        },
      ],
      title:
        "Reps' own declared won revenue (sales_leads) this period vs a manually-set monthly quota (sales_targets). Win Rate is WON deals as a share of WON + LOST closed this period. Active Pipeline Value is a live snapshot of open, uncancelled pipeline right now -- ignores the date filter. Pipeline Cycle is the average days from lead creation to a WON deal this period.",
    },

    // TILE 2: Sales Orders. "Open Backlog"/"Open Units" removed (2026-09-30,
    // per explicit product decision -- both were flagged as unreliable: Open
    // Units needs order-line data this RPC doesn't query, and Open Backlog
    // was a crude cross-table RM subtraction, not a real cumulative figure).
    // What's actually unbilled is now answered properly by Card 8's Not Yet
    // Invoiced cohort instead.
    {
      icon: FileTextIcon,
      label: "Sales Orders",
      sublabel: periodLabel,
      value: preciseCurrencyWithCents(kpis.orderBookValue),
      // Nothing to combine this delta with -- no order-level target exists.
      subvalue: deltaText(orderBookDelta),
      // Informational -- no natural target to evaluate order value against.
      variant: "blueCard",
      to: canAccessOrders ? "../orders/all" : null,
      filter: { ...baseFilterSAP, ...periodFilter },
      metrics: [
        {
          label: "Order Count",
          value: kpis.orderBookCount || 0,
          to: canAccessOrders ? "../orders/all" : null,
          filter: { ...baseFilterSAP, ...periodFilter },
        },
        {
          label: "Avg Order Value",
          value: compactCurrency(kpis.avgOrderValue),
        },
        {
          label: "Distinct Customers Ordering",
          value: kpis.distinctCustomersOrdering || 0,
        },
      ],
      title:
        "Value of Sales Orders booked this period. What's still owed on those orders (overdue delivery, payment mismatches, not-yet-invoiced) is covered by the Sales Order Health card below.",
    },

    // TILE 3: Invoiced Revenue (renamed from "Invoice VS Budget", Avg
    // Invoice Value relocated here from Payments Collected -- 2026-09-30).
    //
    // Verification #1 (unresolved, flagged directly by the user): does this
    // include invoices not related to any sales order? Confirmed structurally
    // -- no sales-order<->invoice document join exists anywhere in this RPC
    // (see the RPC's own header comment). Rep-filtering itself IS correct
    // (confirmed -- selecting a Salesperson only ever shows their own
    // invoices). Whether an unfiltered, company-wide read should exclude an
    // invoice with a null sales_rep_code is still open -- needs a live check
    // against hyrax-data-platform on whether SAP ever legitimately leaves a
    // real sale's sales_rep_code null, so it's deliberately left as-is
    // rather than silently guessed either way.
    {
      icon: ReceiptIcon,
      label: "Invoiced Revenue",
      sublabel: periodLabel,
      value: preciseCurrencyWithCents(kpis.totalInvoiced),
      subvalue: pctWithDelta(kpis.budgetAttainmentPct, budgetAttainmentDelta),
      variant: invoiceBudgetStatus.variant,
      status: {
        icon: invoiceBudgetStatus.statusIcon,
        label: invoiceBudgetStatus.statusLabel,
      },
      to: canAccessInvoices ? "/app/finance/invoices/list" : null,
      filter: { ...baseFilterSAP, ...periodFilter },
      metrics: [
        {
          label: "Revenue Budget",
          value: preciseCurrencyWithCents(kpis.revenueBudgetTotal),
          to: "/app/sales/orders/budgets",
          // Budgets' own filterConfig.js keys on salesRepCode too -- see
          // baseFilterSAP's own comment above.
          filter: { ...baseFilterSAP },
        },
        {
          label: "Invoice Count",
          value: kpis.invoiceCount || 0,
        },
        {
          label: "Avg Invoice Value",
          value: compactCurrency(kpis.avgInvoiceValue),
        },
      ],
      title:
        "Backward-looking, Invoiced Revenue VS Invoice Budget. Avg Invoice Value is the mean of all invoices issued this period, regardless of whether they were paid.",
    },

    // TILE 4: Payments Collected. FIXED 2026-09-30 (verification #2, flagged
    // directly by the user): this figure previously included cash not
    // related to any sales invoice at all (on-account cash, other SAP
    // document types) -- confirmed as a real bug. Now rescoped server-side
    // to only cash applied against a real sales invoice; that excluded cash
    // is Finance's own reconciliation concern and is deliberately NOT shown
    // here as a companion metric.
    {
      icon: WalletIcon,
      label: "Payments Collected",
      sublabel: periodLabel,
      value: preciseCurrencyWithCents(kpis.totalCollected),
      subvalue: pctWithDelta(kpis.collectionRatePct, collectionRateDelta),
      variant: paymentsCollectedStatus.variant,
      status: {
        icon: paymentsCollectedStatus.statusIcon,
        label: paymentsCollectedStatus.statusLabel,
      },
      // NOTE: no salesRepCode here, unlike every other SAP-sourced link on
      // this page (see baseFilterSAP's own comment) -- paymentsService.js has
      // no sales-rep filter at all today, so when an Owner is selected this
      // link can't be scoped to match kpis.totalCollected the way Sales
      // Orders/Invoiced Revenue/Customer Concentration now are. A real,
      // currently-unfixable gap on the Payments list page itself, not an
      // oversight here.
      to: canAccessPayments ? "/app/finance/invoices/payments" : null,
      filter: { ...periodFilter },
      metrics: [
        {
          label: "Payment Count",
          value: kpis.paymentCount || 0,
        },
        {
          label: "Distinct Customers Paid",
          value: kpis.distinctCustomersPaid || 0,
        },
      ],
      title:
        "Cash applied against a real sales invoice via SAP payment applications this period -- on-account cash and other non-invoice payment applications are excluded. Collection Rate is the share of this period's invoiced revenue that was collected in it.",
    },

    // TILE 5: Customer Concentration -- unchanged in kind, now reads its
    // value from the RPC's own kpis.customerConcentrationPct (exact, same
    // window as topInvoicedCustomers) rather than a client-side recompute.
    {
      icon: UsersThreeIcon,
      label: "Customer Concentration",
      sublabel: `Top 5, ${periodLabel}`,
      value:
        kpis.customerConcentrationPct === null ||
        kpis.customerConcentrationPct === undefined
          ? "—"
          : `${kpis.customerConcentrationPct}%`,
      variant: customerConcentrationStatus.variant,
      status: {
        icon: customerConcentrationStatus.statusIcon,
        label: customerConcentrationStatus.statusLabel,
      },
      to: canAccessInvoices ? "/app/finance/invoices/list" : null,
      filter: {
        ...baseFilterSAP,
        customerCodes: top5Invoiced.map((c) => c.customer_code).join(","),
        ...periodFilter,
      },
      metrics: [
        {
          label: "Top 5 Revenue",
          value: compactCurrency(kpis.top5CustomerRevenue),
          to: canAccessInvoices ? "/app/finance/invoices/list" : null,
          filter: {
            ...baseFilterSAP,
            customerCodes: top5Invoiced.map((c) => c.customer_code).join(","),
            ...periodFilter,
          },
        },
        {
          label: "Top Customer",
          value:
            kpis.topCustomerName && kpis.topCustomerPct !== null
              ? `${kpis.topCustomerName} (${kpis.topCustomerPct}%)`
              : (kpis.topCustomerName ?? "—"),
          to:
            canAccessInvoices && top5Invoiced[0]?.customer_code
              ? "/app/finance/invoices/list"
              : null,
          filter: {
            ...baseFilterSAP,
            customerCode: top5Invoiced[0]?.customer_code,
            ...periodFilter,
          },
        },
      ],
      title:
        "Share of this period's invoiced revenue held by the 5 largest customers. Above 60% means the department's number depends on a handful of relationships.",
    },

    // TILE 6: Product Concentration (new, 2026-09-30) -- same numerator/
    // denominator principle as Customer Concentration, both from
    // base_invoice_lines/sap_invoice_lines (billed, not booked). No new
    // tables -- topProductsData already queries this join chain.
    {
      icon: PackageIcon,
      label: "Product Concentration",
      sublabel: `Top 5, ${periodLabel}`,
      value:
        kpis.productConcentrationPct === null ||
        kpis.productConcentrationPct === undefined
          ? "—"
          : `${kpis.productConcentrationPct}%`,
      variant: productConcentrationStatus.variant,
      status: {
        icon: productConcentrationStatus.statusIcon,
        label: productConcentrationStatus.statusLabel,
      },
      // No item-code drill-through filter exists on any list page today --
      // informational only, same as a ratio/snapshot tile with no matching
      // row-set.
      to: null,
      metrics: [
        {
          label: "Top 5 Revenue",
          value: compactCurrency(kpis.top5ProductRevenue),
        },
        {
          label: "Top Product",
          value:
            kpis.topProductName && kpis.topProductPct !== null
              ? `${kpis.topProductName} (${kpis.topProductPct}%)`
              : (kpis.topProductName ?? top5Products[0]?.item_name ?? "—"),
        },
      ],
      title:
        "Share of this period's invoiced (billed) revenue held by the 5 best-selling products. A high share means revenue depends heavily on a handful of SKUs.",
    },

    // TILE 7: Product Group Concentration (new, 2026-09-30) -- top-3, not
    // top-5: only ~13 SAP item groups (OITB) exist company-wide, so top-3 is
    // the more meaningful cut. Same base_invoice_lines source as Product
    // Concentration above, aggregated by group instead of by item.
    {
      icon: StackIcon,
      label: "Product Group Concentration",
      sublabel: `Top 3, ${periodLabel}`,
      value:
        kpis.productGroupConcentrationPct === null ||
        kpis.productGroupConcentrationPct === undefined
          ? "—"
          : `${kpis.productGroupConcentrationPct}%`,
      variant: productGroupConcentrationStatus.variant,
      status: {
        icon: productGroupConcentrationStatus.statusIcon,
        label: productGroupConcentrationStatus.statusLabel,
      },
      to: null,
      metrics: [
        {
          label: "Top 3 Revenue",
          value: compactCurrency(kpis.top3GroupRevenue),
        },
        {
          label: "Top Group",
          value:
            kpis.topGroupName && kpis.topGroupPct !== null
              ? `${kpis.topGroupName} (${kpis.topGroupPct}%)`
              : (kpis.topGroupName ?? top3Groups[0]?.item_group_name ?? "—"),
        },
      ],
      title:
        "Share of this period's invoiced (billed) revenue held by the 3 largest SAP item groups. A high share means revenue depends heavily on a narrow category of products.",
    },

    // TILE 8: Sales Order Health (new, ACTIONABLE) -- answers the question
    // this page never had an answer to: which booked orders actually need
    // attention right now. Defaults to the true current backlog (unbounded),
    // narrows to "originated this period" once a range is picked -- see
    // actionableLabel above. All 4 filter keys are the Sales Orders list
    // page's own real, already-verified filters.
    {
      icon: WarningCircleIcon,
      label: "Sales Order Fulfillment",
      sublabel: actionableLabel,
      value: kpis.salesOrderNeedsAttentionCount || 0,
      variant: salesOrderHealthStatus.variant,
      status: {
        icon: salesOrderHealthStatus.statusIcon,
        label: salesOrderHealthStatus.statusLabel,
      },
      // The headline is an OR of 4 independent, possibly-overlapping
      // cohorts -- no single filter reproduces it faithfully. Each cohort is
      // independently correct as its own sub-metric instead, same pattern as
      // Employee Overview's Data Gaps/HR Actions Needed.
      to: null,
      metrics: [
        {
          label: "Overdue Deliveries",
          value: kpis.overdueDeliveriesCount || 0,
          to: canAccessOrders ? "../orders/all" : null,
          filter: overdueDeliveryFilter,
        },
        {
          label: "Delivery Due Soon",
          value: kpis.deliveryDueSoonCount || 0,
          to: canAccessOrders ? "../orders/all" : null,
          filter: deliveryDueSoonFilter,
        },
        {
          label: "Payment Mismatches",
          value: kpis.paymentMismatchesCount || 0,
          to: canAccessOrders ? "../orders/all" : null,
          filter: paymentMismatchFilter,
        },
        {
          label: "Not Yet Invoiced",
          value: kpis.notYetInvoicedCount || 0,
          to: canAccessOrders ? "../orders/all" : null,
          filter: notYetInvoicedFilter,
        },
      ],
      title:
        "Open, uncancelled Sales Orders needing attention: delivery overdue, delivery due within 7 days, a paid-vs-applied payment mismatch, or zero matched invoices. The sub-counts can overlap (one order can match more than one reason), so they don't need to sum to the headline count. Defaults to the full current backlog; narrows to orders placed in the selected period once a date range is picked.",
    },
  ];
}
