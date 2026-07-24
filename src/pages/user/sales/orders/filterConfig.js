import {
  getSapCustomerByCode,
  searchSapCustomers,
} from "../../../../features/sales/orders/private/api/salesOrdersMetadataService";

export function getSalesOrdersFilterConfig({ salesReps }) {
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
  ];
}
