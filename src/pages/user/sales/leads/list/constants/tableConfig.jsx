import { searchClients } from "../../../../../../features/sales/clients/private/api/clientSearch";
import {
  getContactById,
  searchContacts,
} from "../../../../../../features/sales/contacts/private/api/contactSearch";

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
    clears: ["client_contact_id"],
  },
  {
    key: "client_contact_id",
    label: "Contact",

    getValue: (lead) =>
      lead.client_contact
        ? {
            value: lead.client_contact.id,
            label: lead.client_contact.full_name,
          }
        : null,

    displayValue: (lead) => lead.client_contact?.full_name,

    editable: true,

    editor: "asyncSelect",

    loadOptions: (search, formData) => {
      const clientId =
        typeof formData.client_id === "object"
          ? formData.client_id?.value
          : formData.client_id;

      return searchContacts(search, clientId);
    },

    getOptionByValue: getContactById,

    getDisplayValue: async (value) => {
      const option = await getContactById(value);
      return option?.label || value;
    },

    isClearable: false,
    cacheOptions: false,
    dependsOn: ["client_id"],
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
  // {
  //   key: "actual_revenue",
  //   label: "Actual Revenue (RM)",
  //   getValue: "actual_revenue",
  //   editable: true,
  //   editor: "number",
  //   min: 0,
  //   section: "Closing Details",
  //   half: true,
  // },
  {
    key: "po_number",
    label: "PO Number (SAP)",
    getValue: "po_number",
    editable: true,
    editor: "text",
    section: "Closing Details",
    half: true,
  },

  // ==========================================
  // DOCUMENTS (Using your new Drive Picker)
  // ==========================================
  {
    key: "quotation_url",
    label: "Quotation Document",
    getValue: "quotation_url",
    editable: true,
    editor: "drivePicker", // Uses the custom component we just registered
    section: "Documents",
  },
  {
    key: "po_document_url",
    label: "Purchase Order Document",
    getValue: "po_document_url",
    editable: true,
    editor: "drivePicker",
    section: "Documents",
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
