import {
  DesktopIcon,
  WindowsLogoIcon,
  LinuxLogoIcon,
} from "@phosphor-icons/react";
import StatusBadge from "../../../../../../components/status/statusBadge/StatusBadge";

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
  {
    key: "sap_bp_id",
    label: "SAP Business Partner ID",
    getValue: "sap_bp_id",
    editable: true,
    editor: "text",
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
    editor: "text",
  },
  {
    key: "website_url",
    label: "Website",
    getValue: "website_url",
    editable: true,
    editor: "text",
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
