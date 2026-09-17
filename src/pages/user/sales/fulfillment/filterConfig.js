import {
  getSapCustomerByCode,
  searchSapCustomers,
} from "../../../../features/sales/orders/private/api/salesOrdersMetadataService";

/**
 * Reuses Sales Orders' own base filters (customer/rep/status/cancelled),
 * plus the fulfillment-specific stage filters this page adds on top of the
 * sap_sales_orders_with_fulfillment view's own columns. leadMatchedOnly/
 * invoicedOnly/fullyPaidOnly/hasMismatchOnly are each an "Only" boolean, same
 * convention as Sales Orders' own overdueOnly/dueSoonOnly, since those are
 * additive flags a viewer can combine, not a single mutually-exclusive
 * status. deliveryStatus is the one exception -- a real 3-way enum (Not
 * Started/Partial/Fully Delivered), not a boolean, since "partial" only
 * makes sense relative to "fully delivered" and "not started," not as an
 * independent on/off toggle.
 */
export function getFulfillmentOrdersFilterConfig({ salesReps }) {
  return [
    {
      key: "salesRepCode",
      label: "Sales Rep",
      options: salesReps.map((rep) => ({
        label: rep.sales_rep_name,
        value: rep.sales_rep_code,
      })),
    },
    {
      key: "customerCode",
      label: "Customer",
      editor: "asyncSelect",
      loadOptions: searchSapCustomers,
      getOptionByValue: getSapCustomerByCode,
      getDisplayValue: async (value) => {
        const option = await getSapCustomerByCode(value);
        return option?.label || value;
      },
    },
    {
      key: "statusCode",
      label: "Status",
      options: [
        { label: "Open", value: "O" },
        { label: "Closed", value: "C" },
      ],
    },
    {
      key: "isCancelled",
      label: "Cancelled",
      options: [
        { label: "Active", value: "N" },
        { label: "Cancelled", value: "Y" },
      ],
    },
    {
      key: "leadMatchedOnly",
      label: "Lead Matched Only",
      options: [
        { label: "All", value: "false" },
        { label: "Lead Matched Only", value: "true" },
      ],
    },
    {
      key: "deliveryStatus",
      label: "Delivery Fulfillment",
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "Partial Delivery", value: "partial" },
        { label: "Fully Delivered", value: "delivered" },
      ],
    },
    {
      key: "invoicedOnly",
      label: "Invoiced Only",
      options: [
        { label: "All", value: "false" },
        { label: "Invoiced Only", value: "true" },
      ],
    },
    {
      key: "fullyPaidOnly",
      label: "Fully Paid Only",
      options: [
        { label: "All", value: "false" },
        { label: "Fully Paid Only", value: "true" },
      ],
    },
    {
      key: "hasMismatchOnly",
      label: "Payment Mismatch",
      options: [
        { label: "All", value: "false" },
        { label: "Mismatch Only", value: "true" },
      ],
    },
  ];
}
