// pages/user/sales/leads/targets/tableConfig.jsx
import { searchEmployees, getEmployeeById } from "../../../../../features/sales/salesTargets/private/api/employeeSearch";

function formatMonth(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export const salesTargetsTableConfig = () => [
  {
    key: "id",
    label: "ID",
    getValue: (row) => row.id,
    show: false,
  },
  {
    key: "lead_owner_id",
    label: "Sales Rep",
    getValue: (row) =>
      row.employee
        ? { value: row.employee.id, label: row.employee.full_name }
        : null,
    displayValue: (row) => row.employee?.full_name || "—",
    editable: true,
    editor: "asyncSelect",
    loadOptions: searchEmployees,
    getOptionByValue: getEmployeeById,
    required: true,
    isClearable: false,
  },
  {
    key: "target_month",
    label: "Target Month",
    getValue: (row) => row.target_month,
    displayValue: (row) => formatMonth(row.target_month),
    editable: true,
    editor: "date",
    required: true,
  },
  {
    key: "target_revenue",
    label: "Target Revenue (RM)",
    getValue: (row) => row.target_revenue,
    displayValue: (row) =>
      `RM ${Math.round(row.target_revenue || 0).toLocaleString()}`,
    editable: true,
    editor: "number",
    min: 0,
    required: true,
  },
];
