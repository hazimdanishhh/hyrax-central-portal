import {
  getSapVendorByCode,
  searchSapVendors,
} from "../../../../features/finance/reports/private/api/financeMetadataService";

export function getBillsFilterConfig() {
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
