import {
  searchEmployees,
  getEmployeeById,
} from "../../../../../features/sales/salesTargets/private/api/employeeSearch";

export function getSalesTargetsFilterConfig() {
  return [
    {
      key: "owner",
      label: "Sales Rep",
      editor: "asyncSelect",
      loadOptions: searchEmployees,
      getOptionByValue: getEmployeeById,
      getDisplayValue: async (value) => {
        const option = await getEmployeeById(value);
        return option?.label || value;
      },
    },
  ];
}
