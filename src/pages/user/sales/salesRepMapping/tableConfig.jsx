// pages/user/sales/salesRepMapping/tableConfig.jsx
import {
  searchEmployees,
  getEmployeeById,
} from "../../../../features/sales/salesTargets/private/api/employeeSearch";

export const salesRepMappingTableConfig = () => [
  {
    key: "sales_rep_code",
    label: "SAP Rep Code",
    getValue: (row) => row.sales_rep_code,
    editable: false,
  },
  {
    key: "sales_rep_name",
    label: "SAP Rep Name",
    getValue: (row) => row.sap_sales_person?.sales_rep_name || "—",
    editable: false,
  },
  {
    key: "sap_is_active",
    label: "SAP Status",
    getValue: (row) =>
      row.sap_sales_person?.is_active === "Y" ? "Active" : "Inactive",
    editable: false,
  },
  {
    key: "employee_id",
    label: "Linked Employee",
    getValue: (row) =>
      row.employee
        ? { value: row.employee.id, label: row.employee.full_name }
        : null,
    displayValue: (row) => row.employee?.full_name || "Unmapped",
    editable: true,
    editor: "asyncSelect",
    loadOptions: searchEmployees,
    getOptionByValue: getEmployeeById,
    isClearable: true,
  },
];
