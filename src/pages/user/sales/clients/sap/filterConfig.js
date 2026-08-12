export function getSapClientsFilterConfig() {
  return [
    {
      key: "localExportFlag",
      label: "Local / Export",
      options: [
        // Real values are the full words, not 'L'/'E' -- verified live
        // against sap_business_partner_master.csv (2026-07-02); the
        // hyrax-data-platform data dictionary had this wrong.
        { label: "Local", value: "Local" },
        { label: "Export", value: "Export" },
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
