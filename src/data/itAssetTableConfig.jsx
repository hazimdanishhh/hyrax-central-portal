// data/itAssetTableConfig.jsx
import {
  DesktopIcon,
  WindowsLogoIcon,
  LinuxLogoIcon,
} from "@phosphor-icons/react";
import StatusBadge from "../components/status/statusBadge/StatusBadge";

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const itAssetTableConfig = ({
  categories,
  subcategories,
  statuses,
  conditions,
  operatingSystems,
  employees,
  departments,
  manufacturers,
}) => [
  // {
  //   key: "type",
  //   label: "Type / OS",
  //   editable: false,
  //   render: (_, asset) => (
  //     <div style={{ display: "flex", gap: 6 }}>
  //       {asset.asset_subcategory?.name?.toLowerCase().includes("desktop") && (
  //         <DesktopIcon size={20} />
  //       )}

  //       {asset.operating_system?.name?.toLowerCase().includes("windows") && (
  //         <WindowsLogoIcon size={20} />
  //       )}

  //       {asset.operating_system?.name?.toLowerCase().includes("linux") && (
  //         <LinuxLogoIcon size={20} />
  //       )}
  //     </div>
  //   ),
  // },
  {
    key: "id",
    label: "ID",
    getValue: "id",
    editable: false,
    editor: "text",
  },
  {
    key: "asset_name",
    label: "Asset Name",
    getValue: "asset_name",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    key: "asset_code",
    label: "Asset Code",
    getValue: "asset_code",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    key: "asset_status_id",
    label: "Status",
    getValue: (asset) => asset.asset_status?.id,
    displayValue: (asset) => asset.asset_status?.name,
    // render: (value) => <StatusBadge status={value} />,
    editable: true,
    editor: "select",
    options: statuses.map((s) => ({
      label: s.name,
      value: s.id,
    })),
  },
  {
    key: "asset_category_id",
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
    key: "asset_subcategory_id",
    label: "Subcategory",
    getValue: (asset) => asset.asset_subcategory?.id,
    displayValue: (asset) => asset.asset_subcategory?.name,
    editable: true,
    editor: "select",
    options: subcategories.map((s) => ({
      label: s.name,
      value: s.id,
    })),
  },
  {
    key: "asset_user_id",
    label: "Assigned To",
    getValue: (asset) => asset.asset_user?.id,
    displayValue: (asset) => asset.asset_user?.full_name,
    editable: true,
    editor: "select",
    options: employees.map((e) => ({
      label: e.full_name,
      value: e.id,
    })),
  },
  {
    key: "mdm_status",
    label: "MDM Status",
    getValue: (asset) => asset.mdm_status,
    editable: true,
    editor: "select",
    options: [
      { label: "Enrolled", value: "Enrolled" },
      {
        label: "Not Enrolled",
        value: "Not Enrolled",
      },
      {
        label: "Pending Enrollment",
        value: "Pending Enrollment",
      },
      {
        label: "Retired",
        value: "Retired",
      },
    ],
  },
  {
    key: "mdm_link",
    label: "MDM Link",
    getValue: (asset) => asset.mdm_link,
    editable: true,
    editor: "link",
  },
  {
    key: "serial_number",
    label: "Serial Number",
    getValue: "serial_number",
    editable: true,
    editor: "text",
  },
  {
    key: "asset_manufacturer_id",
    label: "Manufacturer",
    getValue: (asset) => asset.asset_manufacturer?.id,
    displayValue: (asset) => asset.asset_manufacturer?.name,
    editable: true,
    editor: "select",
    options: manufacturers.map((m) => ({
      label: m.name,
      value: m.id,
    })),
  },
  {
    key: "asset_model",
    label: "Model",
    getValue: (asset) => asset.asset_model,
    editable: true,
    editor: "text",
  },
  {
    key: "operating_system_id",
    label: "Operating System",
    getValue: (asset) => asset.operating_system?.id,
    displayValue: (asset) => asset.operating_system?.name,
    editable: true,
    editor: "select",
    options: operatingSystems.map((o) => ({
      label: o.name,
      value: o.id,
    })),
  },
  {
    key: "product_key",
    label: "Product Key",
    getValue: (asset) => asset.product_key,
    editable: true,
    editor: "text",
  },
  {
    key: "mac_address",
    label: "MAC Address",
    getValue: (asset) => asset.mac_address,
    editable: true,
    editor: "text",
  },
  {
    key: "management_ip",
    label: "IP Address",
    getValue: (asset) => asset.management_ip,
    editable: true,
    editor: "text",
  },
  {
    key: "asset_condition_id",
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
    key: "asset_location_id",
    label: "Location",
    getValue: (asset) => asset.location?.name,
    editable: true,
    editor: "text",
  },
  {
    key: "asset_department_id",
    label: "Department",
    getValue: (asset) => asset.asset_department?.id,
    displayValue: (asset) => asset.asset_department?.name,
    editable: true,
    editor: "select",
    options: departments.map((d) => ({
      label: d.name,
      value: d.id,
    })),
  },
  {
    key: "purchase_date",
    label: "Purchase Date",
    getValue: (asset) => asset.purchase_date,
    editable: true,
    editor: "date",
  },
  {
    key: "purchase_cost",
    label: "Purchase Cost",
    getValue: (asset) => asset.purchase_cost,
    editable: true,
    editor: "number",
  },
  {
    key: "vendor_id",
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
    editor: "date",
  },
  {
    key: "retire_date",
    label: "Retire Date",
    getValue: (asset) => asset.retire_date,
    editable: true,
    editor: "date",
  },
  {
    key: "notes",
    label: "Notes",
    getValue: (asset) => asset.notes,
    editable: true,
    editor: "text",
  },
];
