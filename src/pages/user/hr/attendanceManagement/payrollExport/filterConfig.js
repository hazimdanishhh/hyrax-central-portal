// pages/user/hr/attendanceManagement/payrollExport/filterConfig.js

// Deliberately department/employee only (no Work Location) -- unlike
// overview/filterConfig.js, get_payroll_period_summary_rpc.sql has no
// p_work_location_id parameter, so offering that filter here would silently
// do nothing.
export function getPayrollExportFilterConfig({ departments, employees }) {
  return [
    {
      key: "department",
      label: "Department",
      options: (departments || []).map((d) => ({ label: d.name, value: d.id })),
    },
    {
      key: "employee",
      label: "Employee",
      options: (employees || []).map((e) => ({ label: e.full_name, value: e.id })),
    },
  ];
}
