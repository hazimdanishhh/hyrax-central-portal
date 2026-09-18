import { buildStatusTabs } from "../../../../functions/statusTabs";

/**
 * Mirrors the exact "current stage" vocabulary getFulfillmentStageSummary
 * already computes for every card/sidebar badge (Order Created -> Delivery
 * In Progress -> Delivered -> Invoiced -> Fully Paid, or Order Cancelled),
 * so a tab's row count always matches "how many cards show this badge" --
 * no statusCode gate here on purpose, unlike the Open Backlog/Overdue
 * Delivery KPI tiles (which deliberately only count SAP-open orders, since
 * a closed order is a deliberate business decision to stop, not live
 * backlog). Tabs answer "what stage is this order at" regardless of whether
 * SAP has closed it; tiles answer "what needs action today" -- different
 * questions, so different filters.
 *
 * "Fully Paid, Delivery Unconfirmed" is the one anomaly state promoted to
 * its own tab, out of the four getFulfillmentStageSummary can flag inline
 * (Partial-Delivery-while-Invoiced, Fully-Paid-Partially-Delivered,
 * Fully-Paid-Not-Delivered, Payment-Mismatch-on-a-fully-paid-order). The
 * first is a documented normal SAP pattern, not a problem worth browsing
 * for. The mismatch case is already reachable via the `hasMismatchOnly`
 * filter and the "Invoiced, Not Fully Paid" tile's own sub-metric. The
 * remaining two both answer the same actionable question -- "money's in,
 * did we actually ship it?" -- so they're merged into one tab rather than
 * split, matching isFullyPaid && !isFullyDelivered exactly (deliveryStatus:
 * "open" already means !is_fully_delivered, covering both the
 * partially-delivered and not-delivered-at-all sub-cases in one filter).
 *
 * All conditions reuse existing filter keys/values already wired into
 * fulfillmentOrdersService.js -- no new ones needed.
 */
export function getSalesOrdersTabsConfig(searchParams) {
  return buildStatusTabs({
    searchParams,
    statuses: [],
    paramKey: "stage",
    extraTabs: [
      {
        label: "Order Created",
        type: "blue",
        conditions: [
          { paramKey: "isCancelled", value: "N" },
          { paramKey: "deliveryStatus", value: "not_started" },
          { paramKey: "invoicedOnly", value: "none" },
        ],
      },
      {
        label: "Delivery In Progress",
        type: "blue",
        conditions: [
          { paramKey: "isCancelled", value: "N" },
          { paramKey: "deliveryStatus", value: "partial" },
        ],
      },
      {
        label: "Delivered",
        type: "blue",
        conditions: [
          { paramKey: "isCancelled", value: "N" },
          { paramKey: "deliveryStatus", value: "delivered" },
          { paramKey: "fullyPaidOnly", value: "none" },
        ],
      },
      {
        label: "Invoiced",
        type: "blue",
        conditions: [
          { paramKey: "isCancelled", value: "N" },
          { paramKey: "invoicedOnly", value: "true" },
          { paramKey: "fullyPaidOnly", value: "none" },
        ],
      },
      {
        label: "Fully Paid",
        type: "green",
        conditions: [
          { paramKey: "isCancelled", value: "N" },
          { paramKey: "fullyPaidOnly", value: "true" },
          { paramKey: "deliveryStatus", value: "delivered" },
        ],
      },
      {
        label: "Fully Paid, Delivery Unconfirmed",
        type: "yellow",
        conditions: [
          { paramKey: "isCancelled", value: "N" },
          { paramKey: "fullyPaidOnly", value: "true" },
          { paramKey: "deliveryStatus", value: "open" },
        ],
      },
      {
        label: "Cancelled",
        type: "red",
        conditions: [{ paramKey: "isCancelled", value: "Y" }],
      },
    ],
  });
}
