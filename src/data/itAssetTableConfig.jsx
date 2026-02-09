// data/itAssetTableConfig.jsx
import { Desktop, WindowsLogo, LinuxLogo } from "phosphor-react";
import StatusBadge from "../components/status/statusBadge/StatusBadge";
// getValue - data name
// editor - data type
// options - for option input

export const itAssetTableConfig = ({
  categories,
  subcategories,
  statuses,
  conditions,
  operatingSystems,
}) => [
  {
    key: "type",
    label: "Type / OS",
    getValue: () => null,
    render: (_, asset) => (
      <div style={{ display: "flex", gap: 6 }}>
        {asset.asset_subcategory?.name?.toLowerCase().includes("desktop") && (
          <Desktop size={20} />
        )}

        {asset.operating_system?.name?.toLowerCase().includes("windows") && (
          <WindowsLogo size={20} />
        )}

        {asset.operating_system?.name?.toLowerCase().includes("linux") && (
          <LinuxLogo size={20} />
        )}
      </div>
    ),
  },
  {
    key: "asset_name",
    label: "Asset Name",
    getValue: "asset_name",
    editable: true,
    editor: "text",
  },
  {
    key: "asset_code",
    label: "Asset Code",
    getValue: "asset_code",
    editable: true,
    editor: "text",
  },
  {
    key: "status",
    label: "Status",
    getValue: (asset) => asset.asset_status?.name,
    render: (value) => <StatusBadge status={value} />,
    editable: true,
    editor: "text",
  },
  {
    key: "category",
    label: "Category",
    getValue: (asset) => asset.asset_category?.id,
    displayValue: (asset) => asset.asset_category?.name,
    editable: true,
    editor: "select",
    options: categories.map((c) => ({
      label: c.name,
      value: c.id,
    })),
  },
  {
    key: "subcategory",
    label: "Subcategory",
    getValue: (asset) => asset.asset_subcategory?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "user",
    label: "Assigned To",
    getValue: (asset) => asset.asset_user?.full_name,
    editable: true,
    editor: "text",
  },
  {
    key: "mdm_status",
    label: "MDM Status",
    getValue: (asset) => asset.mdm_status,
    editable: true,
    editor: "text",
  },
  {
    key: "mdm_link",
    label: "MDM Link",
    getValue: (asset) => asset.mdm_link,
    editable: true,
    editor: "text",
  },
  {
    key: "serial",
    label: "Serial Number",
    getValue: "serial_number",
    editable: true,
    editor: "text",
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    getValue: (asset) => asset.manufacturer,
    editable: true,
    editor: "text",
  },
  {
    key: "model",
    label: "Model",
    getValue: (asset) => asset.model,
    editable: true,
    editor: "text",
  },
  {
    key: "os",
    label: "Operating System",
    getValue: (asset) => asset.operating_system?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "product_key",
    label: "Product Key",
    getValue: (asset) => asset.product_key,
    editable: true,
    editor: "text",
  },
  {
    key: "mac",
    label: "MAC Address",
    getValue: (asset) => asset.mac_address,
    editable: true,
    editor: "text",
  },
  {
    key: "ip",
    label: "IP Address",
    getValue: (asset) => asset.management_ip,
    editable: true,
    editor: "text",
  },
  {
    key: "condition",
    label: "Condition",
    getValue: (asset) => asset.asset_condition?.id,
    displayValue: (asset) => asset.asset_condition?.name,
    editable: true,
    editor: "select",
    options: conditions.map((c) => ({
      label: c.name,
      value: c.id,
    })),
  },
  {
    key: "location",
    label: "Location",
    getValue: (asset) => asset.location?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "department",
    label: "Department",
    getValue: (asset) => asset.department?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "purchase_date",
    label: "Purchase Date",
    getValue: (asset) => asset.purchase_date,
    editable: true,
    editor: "text",
  },
  {
    key: "purchase_cost",
    label: "Purchase Cost",
    getValue: (asset) => asset.purchase_cost,
    editable: true,
    editor: "text",
  },
  {
    key: "vendor",
    label: "Vendor",
    getValue: (asset) => asset.vendor?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "purchase_order",
    label: "Purchase Order",
    getValue: (asset) => asset.purchase_order,
    editable: true,
    editor: "text",
  },
  {
    key: "warranty_expiry",
    label: "Warranty Expiry",
    getValue: (asset) => asset.warranty_expiry,
    editable: true,
    editor: "text",
  },
  {
    key: "retire_date",
    label: "Retire Date",
    getValue: (asset) => asset.retire_date,
    editable: true,
    editor: "text",
  },
  {
    key: "notes",
    label: "Notes",
    getValue: (asset) => asset.notes,
    editable: true,
    editor: "text",
  },
];
