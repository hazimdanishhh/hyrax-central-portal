// data/itAssetTableConfig.jsx
import { Desktop, WindowsLogo, LinuxLogo } from "phosphor-react";
import StatusBadge from "../components/status/statusBadge/StatusBadge";
// accessor - data name
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
    accessor: () => null,
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
    accessor: "asset_name",
    editable: true,
    editor: "text",
  },
  {
    key: "asset_code",
    label: "Asset Code",
    accessor: "asset_code",
    editable: true,
    editor: "text",
  },
  {
    key: "status",
    label: "Status",
    accessor: (asset) => asset.asset_status?.name,
    render: (value) => <StatusBadge status={value} />,
    editable: true,
    editor: "text",
  },
  {
    key: "category",
    label: "Category",
    accessor: "category_id",
    displayAccessor: (asset) => asset.asset_category?.name,
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
    accessor: (asset) => asset.asset_subcategory?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "user",
    label: "Assigned To",
    accessor: (asset) => asset.asset_user?.full_name,
    editable: true,
    editor: "text",
  },
  {
    key: "mdm_status",
    label: "MDM Status",
    accessor: (asset) => asset.mdm_status,
    editable: true,
    editor: "text",
  },
  {
    key: "mdm_link",
    label: "MDM Link",
    accessor: (asset) => asset.mdm_link,
    editable: true,
    editor: "text",
  },
  {
    key: "serial",
    label: "Serial Number",
    accessor: "serial_number",
    editable: true,
    editor: "text",
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    accessor: (asset) => asset.manufacturer,
    editable: true,
    editor: "text",
  },
  {
    key: "model",
    label: "Model",
    accessor: (asset) => asset.model,
    editable: true,
    editor: "text",
  },
  {
    key: "os",
    label: "Operating System",
    accessor: (asset) => asset.operating_system?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "product_key",
    label: "Product Key",
    accessor: (asset) => asset.product_key,
    editable: true,
    editor: "text",
  },
  {
    key: "mac",
    label: "MAC Address",
    accessor: (asset) => asset.mac_address,
    editable: true,
    editor: "text",
  },
  {
    key: "ip",
    label: "IP Address",
    accessor: (asset) => asset.management_ip,
    editable: true,
    editor: "text",
  },
  {
    key: "condition",
    label: "Condition",
    accessor: "condition_id",
    displayAccessor: (asset) => asset.asset_condition?.name,
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
    accessor: (asset) => asset.location?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "department",
    label: "Department",
    accessor: (asset) => asset.department?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "purchase_date",
    label: "Purchase Date",
    accessor: (asset) => asset.purchase_date,
    editable: true,
    editor: "text",
  },
  {
    key: "purchase_cost",
    label: "Purchase Cost",
    accessor: (asset) => asset.purchase_cost,
    editable: true,
    editor: "text",
  },
  {
    key: "vendor",
    label: "Vendor",
    accessor: (asset) => asset.vendor?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "purchase_order",
    label: "Purchase Order",
    accessor: (asset) => asset.purchase_order,
    editable: true,
    editor: "text",
  },
  {
    key: "warranty_expiry",
    label: "Warranty Expiry",
    accessor: (asset) => asset.warranty_expiry,
    editable: true,
    editor: "text",
  },
  {
    key: "retire_date",
    label: "Retire Date",
    accessor: (asset) => asset.retire_date,
    editable: true,
    editor: "text",
  },
  {
    key: "notes",
    label: "Notes",
    accessor: (asset) => asset.notes,
    editable: true,
    editor: "text",
  },
];
