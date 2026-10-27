import {
  getClientById,
  searchClients,
} from "../../../../../../features/sales/clients/private/api/clientSearch";
import {
  getSapCustomerByCode,
  searchSapCustomersForLinking,
} from "../../../../../../features/sales/clients/private/api/sapCustomerSearch";

export function getFilterConfig({
  owners,
  clients,
  leadSourceTypes,
  loseReasons,
}) {
  return [
    {
      key: "owner",
      label: "Salesperson",
      options: owners.map((c) => ({ label: c.full_name, value: c.id })),
    },
    // {
    //   key: "client",
    //   label: "Client",
    //   options: clients.map((s) => ({ label: s.name, value: s.id })),
    // },
    {
      key: "client",
      label: "Client (Prospect)",
      editor: "asyncSelect",
      loadOptions: searchClients,
      getOptionByValue: getClientById,
      getDisplayValue: async (value) => {
        const option = await getClientById(value);
        return option?.label || value;
      },
    },
    {
      key: "sapCustomer",
      label: "SAP Customer",
      editor: "asyncSelect",
      loadOptions: searchSapCustomersForLinking,
      getOptionByValue: getSapCustomerByCode,
      getDisplayValue: async (value) => {
        const option = await getSapCustomerByCode(value);
        return option?.label || value;
      },
    },
    {
      key: "leadSourceType",
      label: "Lead Source Type",
      options: leadSourceTypes.map((c) => ({ label: c.name, value: c.id })),
    },
    {
      key: "loseReason",
      label: "Lose Reason",
      options: loseReasons.map((c) => ({ label: c.name, value: c.id })),
    },
    {
      key: "productType",
      label: "Product Type",
      options: [
        { label: "TRANSFORMER OILS", value: "TRANSFORMER OILS" },
        { label: "LUBRICANTS", value: "LUBRICANTS" },
        { label: "MIXED", value: "MIXED" },
      ],
    },
    // Stage, on hold, cancelled, pending SAP and outcome are the status
    // tabs' keys (tabConfig.js LEAD_TAB_KEYS), not panel filters -- the panel
    // offered them too, and the two fought over the same URL keys
    // (DASHBOARD-CONVENTIONS §9b, 2026-10-27).
    {
      key: "hasQuotation",
      label: "Quotation",
      options: [{ label: "Has Quotation Sent", value: "true" }],
    },
  ];
}
