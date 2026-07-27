import {
  getSapVendorByCode,
  searchSapVendors,
} from "../../../../features/finance/reports/private/api/financeMetadataService";

// sap_vendor_payments (OVPM) has no sales_rep_code column -- no Sales Rep
// filter here, unlike Invoices.
export function getVendorPaymentsFilterConfig() {
  return [
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
        { label: "All Vendor Payments", value: "false" },
        { label: "Unallocated Only", value: "true" },
      ],
    },
  ];
}
