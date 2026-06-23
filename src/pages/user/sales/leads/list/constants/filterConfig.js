import {
  getClientById,
  searchClients,
} from "../../../../../../features/sales/clients/private/api/clientSearch";

export function getFilterConfig({
  owners,
  clients,
  clientContacts,
  leadSourceTypes,
  loseReasons,
}) {
  return [
    {
      key: "owner",
      label: "Owner",
      options: owners.map((c) => ({ label: c.full_name, value: c.id })),
    },
    // {
    //   key: "client",
    //   label: "Client",
    //   options: clients.map((s) => ({ label: s.name, value: s.id })),
    // },
    {
      key: "client",
      label: "Client",
      editor: "asyncSelect",
      loadOptions: searchClients,
      getOptionByValue: getClientById,
      getDisplayValue: async (value) => {
        const option = await getClientById(value);
        return option?.label || value;
      },
    },
    // {
    //   key: "clientContact",
    //   label: "Client Contact",
    //   options: clientContacts.map((s) => ({ label: s.full_name, value: s.id })),
    // },
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
    {
      key: "stage",
      label: "Stage",
      options: [
        { label: "Discovery", value: "DISCOVERY" },
        { label: "Sample Test", value: "SAMPLE_TEST" },
        { label: "Proposal", value: "PROPOSAL" },
        { label: "Negotiation", value: "NEGOTIATION" },
        { label: "Won", value: "WON" },
        { label: "Lost", value: "LOST" },
      ],
    },
    {
      key: "onHold",
      label: "On Hold",
      options: [
        { label: "True", value: "true" },
        { label: "False", value: "false" },
      ],
    },
    {
      key: "cancelled",
      label: "Cancelled",
      options: [
        { label: "True", value: "true" },
        { label: "False", value: "false" },
      ],
    },
  ];
}
