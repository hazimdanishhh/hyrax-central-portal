import {
  DesktopIcon,
  WindowsLogoIcon,
  LinuxLogoIcon,
} from "@phosphor-icons/react";
import StatusBadge from "../../../../../../components/status/statusBadge/StatusBadge";
import { searchClients } from "../../../../../../features/sales/clients/private/api/clientSearch";

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const leadsTableConfig = ({
  employee,
  owners,
  clients,
  clientContacts,
  leadSourceTypes,
}) => [
  {
    key: "id",
    label: "ID",
    getValue: "id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    key: "title",
    label: "Title",
    getValue: "title",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    key: "description",
    label: "Description",
    getValue: "description",
    editable: true,
    editor: "textarea",
  },
  // {
  //   key: "client_id",
  //   label: "Client",
  //   getValue: (lead) => lead.client?.id,
  //   displayValue: (lead) => lead.client?.name,
  //   editable: true,
  //   editor: "select",
  //   options: clients.map((s) => ({
  //     label: s.name,
  //     value: s.id,
  //   })),
  //   required: true,
  //   half: true,
  //   isClearable: false,
  // },

  {
    key: "client_id",
    label: "Client",

    getValue: (lead) =>
      lead.client
        ? {
            value: lead.client.id,
            label: lead.client.name,
          }
        : null,

    displayValue: (lead) => lead.client?.name,

    editable: true,

    editor: "asyncSelect",

    loadOptions: searchClients,

    required: true,
    isClearable: false,
  },
  {
    key: "client_contact_id",
    label: "Contact",
    getValue: (lead) => lead.client_contact?.id,
    displayValue: (lead) => lead.client_contact?.full_name,
    // render: (value) => <StatusBadge status={value} />,
    editable: true,
    editor: "select",
    // options: clientContacts.map((s) => ({
    //   label: s.full_name,
    //   value: s.id,
    // })),
    options: (formData) => {
      const clientId =
        typeof formData.client_id === "object"
          ? formData.client_id?.value
          : formData.client_id;

      return clientContacts
        .filter((contact) => contact.client_id === clientId)
        .map((contact) => ({
          label: contact.full_name,
          value: contact.id,
        }));
    },
    required: true,
    isClearable: false,
  },
  {
    key: "lead_owner_id",
    label: "Lead Owner",
    getValue: (lead) => lead.lead_owner?.id || employee?.id,
    displayValue: (lead) => lead.lead_owner?.full_name || employee?.full_name,
    editable: true,
    editor: "select",
    options: owners.map((s) => ({
      label: s.full_name,
      value: s.id,
    })),
    required: true,
    isClearable: false,
  },

  // SUCCESS & REVENUE
  {
    key: "close_probability",
    label: "Success (%)",
    getValue: "close_probability",
    editable: true,
    editor: "number",
    min: 0,
    max: 100,
    step: 1,
    section: "Success & Revenue",
    half: true,
  },
  {
    key: "expected_revenue",
    label: "Expected Revenue (RM)",
    getValue: "expected_revenue",
    editable: true,
    editor: "number",
    min: 1,
    section: "Success & Revenue",
    half: true,
  },

  // ADDITIONAL INFORMATION
  {
    key: "lead_source_type_id",
    label: "Lead Source",
    getValue: (lead) => lead.lead_source_type?.id,
    displayValue: (lead) => lead.lead_source_type?.name,
    editable: true,
    editor: "select",
    options: leadSourceTypes.map((s) => ({
      label: s.name,
      value: s.id,
    })),
    section: "Additional Information",
  },
  {
    key: "notes",
    label: "Notes",
    getValue: "notes",
    editable: true,
    editor: "textarea",
    section: "Additional Information",
  },
  //   {
  //     key: "stage",
  //     label: "Stage",
  //     getValue: (lead) => lead.stage || "DISCOVERY",
  //     editable: true,
  //     editor: "select",
  //     options: [
  //       { label: "Discovery", value: "DISCOVERY" },
  //       { label: "Sample Test", value: "SAMPLE_TEST" },
  //       { label: "Proposal", value: "PROPOSAL" },
  //       { label: "Negotiation", value: "NEGOTIATION" },
  //       { label: "Won", value: "WON" },
  //       { label: "Lost", value: "LOST" },
  //       { label: "Cancelled", value: "CANCELLED" },
  //     ],
  //     isClearable: false,
  //   },
  //   {
  //     key: "is_on_hold",
  //     label: "On Hold",
  //     getValue: (lead) => lead.is_on_hold || "false",
  //     editable: true,
  //     editor: "select",
  //     options: [
  //       { label: "True", value: "true" },
  //       { label: "False", value: "false" },
  //     ],
  //     require: true,
  //     isClearable: false,
  //   },
  //   {
  //     key: "is_cancelled",
  //     label: "Cancelled",
  //     getValue: (lead) => lead.is_cancelled || "false",
  //     editable: true,
  //     editor: "select",
  //     options: [
  //       { label: "True", value: "true" },
  //       { label: "False", value: "false" },
  //     ],
  //     require: true,
  //     isClearable: false,
  //   },
];
