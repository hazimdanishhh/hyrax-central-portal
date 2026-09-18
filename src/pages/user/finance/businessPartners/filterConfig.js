export function getBusinessPartnersFilterConfig() {
  return [
    {
      // No default option shown as "selected" -- an unset filter already
      // defaults to Customer+Vendor server-side (see
      // businessPartnersService.js), so "All" is the only entry that needs
      // to be explicit here, matching the FILTER_NULL "skip this
      // restriction" convention every other Finance filterConfig already
      // uses (e.g. invoicesService.js's statusCode/isCancelled).
      key: "cardType",
      label: "Type",
      options: [
        { label: "Customer", value: "C" },
        { label: "Vendor", value: "S" },
        { label: "Lead", value: "L" },
        { label: "All", value: "__null__" },
      ],
    },
    {
      key: "isActive",
      label: "Status",
      options: [
        { label: "Active", value: "Y" },
        { label: "Inactive", value: "N" },
      ],
    },
  ];
}
