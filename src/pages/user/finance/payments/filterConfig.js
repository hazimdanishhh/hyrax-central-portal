import {
  getSapCustomerByCode,
  searchSapCustomers,
} from "../../../../features/finance/reports/private/api/financeMetadataService";

// sap_payments (ORCT) has no sales_rep_code column -- no Sales Rep filter
// here, unlike Invoices.
export function getPaymentsFilterConfig() {
  return [
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
      key: "isCancelled",
      label: "Status",
      options: [
        { label: "Active", value: "N" },
        { label: "Cancelled", value: "Y" },
      ],
    },
    {
      key: "unallocatedOnly",
      label: "Unallocated Only",
      options: [
        { label: "All Payments", value: "false" },
        { label: "Unallocated Only", value: "true" },
      ],
    },
  ];
}
