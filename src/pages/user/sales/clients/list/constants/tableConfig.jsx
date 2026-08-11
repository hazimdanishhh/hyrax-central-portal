import {
  DesktopIcon,
  WindowsLogoIcon,
  LinuxLogoIcon,
} from "@phosphor-icons/react";
import StatusBadge from "../../../../../../components/status/statusBadge/StatusBadge";
import {
  searchSapCustomersForLinking,
  getSapCustomerByCode,
} from "../../../../../../features/sales/clients/private/api/sapCustomerSearch";
import { formatSapCustomerOption } from "./sapCustomerOptionLabel";

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const getTableConfig = ({ industries }) => [
  {
    key: "id",
    label: "ID",
    getValue: "id",
    editable: false,
    editor: "text",
    show: false,
  },
  // Link to SAP customer (added 2026-08) -- replaces a free-typed
  // "SAP Business Partner ID" text field that had no validation/lookup at
  // all. Nullable by design: a client with no match here is a genuine
  // Prospect (no SAP relationship yet), not an error state -- see
  // hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.4 for the full
  // decision. formatOptionLabel shows customer_code + city/contact/phone
  // per option so same-named SAP customers (confirmed live: one company can
  // span 70+ customer_codes, branch-driven) are actually distinguishable,
  // not just a repeated name in a plain dropdown.
  {
    key: "sap_customer_code",
    label: "SAP Customer",
    getValue: (client) =>
      client.sap_customer
        ? {
            value: client.sap_customer.customer_code,
            label: client.sap_customer.customer_name,
            city: client.sap_customer.city,
            contactPerson: client.sap_customer.contact_person,
            phone: client.sap_customer.phone,
          }
        : null,
    displayValue: (client) =>
      client.sap_customer
        ? `${client.sap_customer.customer_code} — ${client.sap_customer.customer_name}`
        : "Prospect",
    editable: true,
    editor: "asyncSelect",
    loadOptions: searchSapCustomersForLinking,
    getOptionByValue: getSapCustomerByCode,
    getDisplayValue: async (value) => {
      const option = await getSapCustomerByCode(value);
      return option?.label || value;
    },
    formatOptionLabel: formatSapCustomerOption,
    isClearable: true,
  },
  {
    key: "name",
    label: "Name",
    getValue: "name",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    key: "address",
    label: "Address",
    getValue: "address",
    editable: true,
    editor: "textarea",
  },
  {
    key: "website_url",
    label: "Website",
    getValue: "website_url",
    editable: true,
    editor: "link",
  },
  {
    key: "industry_id",
    label: "Industry",
    getValue: (client) => client.industry?.id,
    displayValue: (client) => client.industry?.name,
    editable: true,
    editor: "select",
    options: industries.map((s) => ({
      label: s.name,
      value: s.id,
    })),
    required: true,
  },
];
