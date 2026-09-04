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
      key: "isCancelled",
      label: "Document State",
      options: [
        { label: "Active", value: "N" },
        { label: "Cancelled", value: "Y" },
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
    {
      key: "dueSoonOnly",
      label: "Due Soon Only",
      options: [
        { label: "All Open/Closed", value: "false" },
        { label: "Due Soon Only", value: "true" },
      ],
    },
  ];
}
