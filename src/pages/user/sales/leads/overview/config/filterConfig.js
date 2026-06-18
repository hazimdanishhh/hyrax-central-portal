import {
  getClientById,
  searchClients,
} from "../../../../../../features/sales/clients/private/api/clientSearch";

export function getFilterConfig({
  owners,
  clients,
  clientContacts,
  leadSourceTypes,
}) {
  return [
    {
      key: "owner",
      label: "Owner",
      options: owners.map((c) => ({ label: c.full_name, value: c.id })),
    },
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
    {
      key: "leadSourceType",
      label: "Lead Source Type",
      options: leadSourceTypes.map((c) => ({ label: c.name, value: c.id })),
    },
  ];
}
