import {
  getSapCustomerByCode,
  searchSapCustomers,
} from "../../../../features/finance/reports/private/api/financeMetadataService";

export function getInvoicesFilterConfig({ salesReps }) {
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
      key: "overdueOnly",
      label: "Overdue Only",
      options: [
        { label: "All Open/Closed", value: "false" },
        { label: "Overdue Only", value: "true" },
      ],
    },
  ];
}
