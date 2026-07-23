import {
  StackIcon,
  TruckIcon,
  CheckCircleIcon,
  HourglassHighIcon,
} from "@phosphor-icons/react";
import {
  compactCurrency,
  compactNumber,
} from "../../../../../functions/formatNumber";

export function getOperationsOverviewConfig(kpis) {
  return [
    // ==========================================
    // PILLAR 1: Open Order Backlog (What's still owed to customers?)
    // ==========================================
    {
      icon: StackIcon,
      label: "Open Order Backlog",
      sublabel: "Open Sales Orders (Not based on period)",
      value: compactCurrency(kpis.openOrderValue),
      variant: "blueCardFill",
      to: null,
      metrics: [
        {
          label: "Open Orders",
          value: kpis.openOrderCount || 0,
        },
        {
          label: "Undelivered Units",
          value: compactNumber(kpis.undeliveredUnits),
        },
      ],
      title: `Value of open sales orders not yet fully delivered, as of today — RM ${Math.round(kpis.openOrderValue || 0).toLocaleString()}`,
    },

    // ==========================================
    // PILLAR 2: On-Time Delivery (Are we shipping when we said we would?)
    // ==========================================
    {
      icon: TruckIcon,
      label: "On-Time Delivery",
      sublabel: "vs Customer Requested Date (This Period)",
      value: `${kpis.onTimeVsRequestPct || 0}%`,
      variant: "greenCard",
      to: null,
      metrics: [
        {
          label: "vs Internal Promise",
          value: `${kpis.onTimeVsPromisePct || 0}%`,
        },
      ],
      title: `Share of deliveries this period that arrived on or before the customer's requested date`,
    },

    // ==========================================
    // PILLAR 3: Fill Rate (Are we shipping complete orders?)
    // ==========================================
    {
      icon: CheckCircleIcon,
      label: "Fill Rate",
      sublabel: "Units Delivered vs Ordered (This Period)",
      value: `${kpis.fillRatePct || 0}%`,
      variant: "yellowCard",
      to: null,
      metrics: [
        {
          label: "Undelivered Units",
          value: compactNumber(kpis.undeliveredUnits),
        },
      ],
      title: `Delivered quantity as a share of ordered quantity for orders placed this period`,
    },

    // ==========================================
    // PILLAR 4: Fulfilment Cycle Time (How long does it take, end to end?)
    // ==========================================
    {
      icon: HourglassHighIcon,
      label: "Fulfilment Cycle Time",
      sublabel: "Order to Invoice, Avg (This Period)",
      value: `${kpis.avgOrderToInvoiceDays || 0}d`,
      variant: "redCard",
      to: null,
      metrics: [
        {
          label: "Order to Ship",
          value: `${kpis.avgOrderToShipDays || 0}d`,
        },
        {
          label: "Ship to Invoice",
          value: `${kpis.avgShipToInvoiceDays || 0}d`,
        },
      ],
      title: `Average days from order placement to invoice, via the delivery step, for orders placed this period`,
    },
  ];
}
