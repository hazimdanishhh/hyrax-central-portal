import {
  getSapCustomerByCode,
  searchSapCustomers,
  getSapVendorByCode,
  searchSapVendors,
} from "../../../../../features/finance/reports/private/api/financeMetadataService";

export function getFilterConfig({ salesReps }) {
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
    // Added 2026-07 (Finance Expansion Phase 1) -- filters the AP chain
    // (base_bills/base_vendor_payments) the same way "Customer" filters AR.
    {
      key: "vendorCode",
      label: "Vendor",
      editor: "asyncSelect",
      loadOptions: searchSapVendors,
      getOptionByValue: getSapVendorByCode,
      getDisplayValue: async (value) => {
        const option = await getSapVendorByCode(value);
        return option?.label || value;
      },
    },
    {
      key: "statusCode",
      label: "Document Status",
      options: [
        { label: "Open", value: "O" },
        { label: "Closed", value: "C" },
      ],
    },
    {
      key: "cancelledOnly",
      label: "Document State",
      options: [
        { label: "Active", value: "false" },
        { label: "Cancelled / Voided Only", value: "true" },
      ],
    },
  ];
}
