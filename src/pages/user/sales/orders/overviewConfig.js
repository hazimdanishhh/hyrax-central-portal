import {
  TruckIcon,
  WarningCircleIcon,
  ReceiptIcon,
  CoinsIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import {
  compactCurrency,
  compactNumber,
} from "../../../../functions/formatNumber";

/**
 * Four tiles for the Lead -> Order -> Delivered -> Invoiced -> Fully Paid
 * pipeline, one per handoff that can actually stall: still-to-deliver (and
 * how late), delivered-but-unbilled, billed-but-uncollected. Same two-tier
 * RM + count shape as Invoices'/Bills' own configs.
 *
 * `to: "."` on every tile/metric, not omitted -- OverviewCards' resolveLinkTo
 * defaults an omitted `to` to "../list", which isn't a real route for this
 * page (it's the "all" tab of a shared orders/budgets layout, not a "list"
 * sibling), so the default would silently 404. "." resolves against the
 * parent `all` route, so it also dismisses an open :docEntry detail sidebar,
 * which is correct.
 *
 * "false" on any of this page's "Only" toggles is a labelled NO-OP in
 * fulfillmentOrdersService.js, never an inversion -- the "none"/"open"/
 * deliveryOverdueOnly values used below are the negative-side filters that
 * exist alongside this file so each tile's drill-through returns exactly the
 * rows the tile counted.
 */
export function getSalesOrdersOverviewConfig(kpis) {
  // statusCode:"O" matches the RPC's own actionability gate on tiles 1-2.
  const backlogFilter = {
    statusCode: "O",
    isCancelled: "N",
    deliveryStatus: "open",
  };
  const overdueDeliveryFilter = {
    statusCode: "O",
    isCancelled: "N",
    deliveryOverdueOnly: "true",
  };
  // No statusCode -- a closed, delivered, unbilled order is still a gap.
  const notInvoicedFilter = {
    isCancelled: "N",
    deliveryStatus: "delivered",
    invoicedOnly: "none",
  };
  const outstandingFilter = {
    isCancelled: "N",
    invoicedOnly: "true",
    fullyPaidOnly: "none",
  };
  const mismatchFilter = { isCancelled: "N", hasMismatchOnly: "true" };

  return [
    {
      icon: TruckIcon,
      label: "Open Backlog",
      value: compactCurrency(kpis.backlogValue),
      variant: "blueCardFill", // hero -- identity, never a verdict
      to: ".",
      filter: backlogFilter,
      metrics: [
        {
          label: "Orders",
          value: kpis.backlogCount,
          to: ".",
          filter: backlogFilter,
        },
        {
          label: "Open Units",
          value: compactNumber(kpis.backlogOpenQty),
          to: ".",
          filter: backlogFilter,
        },
      ],
      title: `Open orders with delivery still outstanding — ${compactCurrency(kpis.backlogValue)} full order value across ${kpis.backlogCount} orders, ${compactNumber(kpis.backlogOpenQty)} units still undelivered`,
    },
    {
      icon: WarningCircleIcon,
      label: "Overdue Delivery",
      value: compactCurrency(kpis.overdueDeliveryValue),
      variant: kpis.overdueDeliveryCount > 0 ? "redCard" : "greenCard",
      to: ".",
      filter: overdueDeliveryFilter,
      metrics: [
        {
          label: "Orders",
          value: kpis.overdueDeliveryCount,
          to: ".",
          filter: overdueDeliveryFilter,
        },
      ],
      title: `Open orders past their requested delivery date with quantity still undelivered — ${compactCurrency(kpis.overdueDeliveryValue)}`,
    },
    {
      icon: ReceiptIcon,
      label: "Delivered, Not Invoiced",
      value: compactCurrency(kpis.deliveredNotInvoicedValue),
      variant: kpis.deliveredNotInvoicedCount > 0 ? "redCard" : "greenCard",
      to: ".",
      filter: notInvoicedFilter,
      metrics: [
        {
          label: "Orders",
          value: kpis.deliveredNotInvoicedCount,
          to: ".",
          filter: notInvoicedFilter,
        },
      ],
      title: `Fully delivered orders with no matched invoice — ${compactCurrency(kpis.deliveredNotInvoicedValue)} of delivered value not yet billed`,
    },
    {
      icon: CoinsIcon,
      label: "Invoiced, Not Fully Paid",
      value: compactCurrency(kpis.outstandingValue),
      // A payment mismatch escalates this tile to red even when the
      // outstanding balance itself is unremarkable, because the sub-metric
      // below means the "fully paid" determination is unverified, not merely
      // unfinished. Outstanding AR alone is yellow, not red -- it's the
      // normal end state of a healthy pipeline (payment terms), not an
      // anomaly.
      variant:
        kpis.mismatchCount > 0
          ? "redCard"
          : kpis.outstandingCount > 0
            ? "yellowCard"
            : "greenCard",
      to: ".",
      filter: outstandingFilter,
      metrics: [
        {
          label: "Orders",
          value: kpis.outstandingCount,
          to: ".",
          filter: outstandingFilter,
        },
        {
          label: "Mismatch",
          value: kpis.mismatchCount,
          icon: kpis.mismatchCount > 0 ? WarningOctagonIcon : undefined,
          to: ".",
          filter: mismatchFilter,
        },
      ],
      title: `Orders with invoices still carrying a balance — ${compactCurrency(kpis.outstandingValue)} outstanding${kpis.mismatchCount > 0 ? `; ${kpis.mismatchCount} order(s) with a ${compactCurrency(kpis.mismatchValue)} paid-vs-applied payment mismatch` : ""}`,
    },
  ];
}
