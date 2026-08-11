import { searchLeadAccounts } from "../../../../../../features/sales/leads/private/api/leadAccountSearch";
import { formatLeadAccountOption } from "./leadAccountOptionLabel";

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const leadsTableConfig = ({
  employee,
  owners,
  leadSourceTypes,
  loseReasons,
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
  // Unified account picker (2026-08): a lead references exactly one of a
  // real SAP customer (sap_customer_code) or a native Prospect (client_id),
  // never a local clients row mirroring an SAP customer -- see
  // hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.4. This is a synthetic
  // column (not a real sales_leads column) -- leadsMutationsService.js
  // splits it into client_id/sap_customer_code before writing.
  {
    key: "account",
    label: "Account",
    getValue: (lead) =>
      lead.client
        ? { __type: "prospect", value: lead.client.id, label: lead.client.name }
        : lead.sap_customer
          ? {
              __type: "sap",
              value: lead.sap_customer.customer_code,
              label: lead.sap_customer.customer_name,
              city: lead.sap_customer.city,
              contactPerson: lead.sap_customer.contact_person,
              phone: lead.sap_customer.phone,
            }
          : null,
    displayValue: (lead) => lead.client?.name || lead.sap_customer?.customer_name,
    editable: true,
    editor: "leadAccountSelect",
    loadOptions: searchLeadAccounts,
    formatOptionLabel: formatLeadAccountOption,
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
    required: true,
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
    required: true,
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
    required: true,
  },
  {
    key: "notes",
    label: "Notes",
    getValue: "notes",
    editable: true,
    editor: "textarea",
    section: "Additional Information",
  },

  {
    key: "product_type",
    label: "Product Type",
    getValue: (lead) => lead.product_type,
    editable: true,
    editor: "select",
    options: [
      { label: "TRANSFORMER OILS", value: "TRANSFORMER OILS" },
      { label: "LUBRICANTS", value: "LUBRICANTS" },
      { label: "MIXED", value: "MIXED" },
    ],
    isClearable: false,
    required: true,
  },

  // {
  //   key: "lose_reason_id",
  //   label: "Lose Reason",
  //   getValue: (lead) => lead.lose_reason?.id,
  //   displayValue: (lead) => lead.lose_reason?.name,
  //   editable: true,
  //   editor: "select",
  //   options: loseReasons.map((s) => ({
  //     label: s.name,
  //     value: s.id,
  //   })),
  //   section: "Additional Information",
  // },

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
  // {
  //   key: "po_number",
  //   label: "PO Number (SAP)",
  //   getValue: "po_number",
  //   editable: true,
  //   editor: "text",
  //   section: "Closing Details",
  //   half: true,
  // },

  // ==========================================
  // DOCUMENTS (Using your new Drive Picker)
  // ==========================================
  // {
  //   key: "quotation_url",
  //   label: "Quotation Document",
  //   getValue: "quotation_url",
  //   editable: true,
  //   editor: "drivePicker", // Uses the custom component we just registered
  //   section: "Documents",
  // },
  // {
  //   key: "po_document_url",
  //   label: "Purchase Order Document",
  //   getValue: "po_document_url",
  //   editable: true,
  //   editor: "drivePicker",
  //   section: "Documents",
  // },

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
