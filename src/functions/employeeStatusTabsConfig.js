// functions/employeeStatusTabsConfig.js
//
// Status-tab row for Employee Management's List page (EmployeeManagement.jsx)
// -- mirrors attendanceStatusTabsConfig.js's shape (statuses + extraTabs fed
// into the generic buildStatusTabs()), built entirely from filter keys/
// values that already exist and work today in
// employeeManagement/list/filterConfig.js (statusBucket, confirmationStatus,
// contractEndingSoon, lifecycleCase) -- this only adds a faster UI entry
// point into them, no query-side change needed.
export function getEmployeeStatusTabsConfig() {
  return {
    statuses: [
      { label: "Active", value: "active" },
      { label: "Terminated", value: "terminated" },
      { label: "Inactive", value: "inactive" },
    ],
    statusTypeMap: {
      active: "green",
      terminated: "red",
      inactive: "grey",
    },
    paramKey: "statusBucket",
    extraTabs: [
      { label: "Confirmation Due Soon", paramKey: "confirmationStatus", value: "due_soon", type: "yellow" },
      { label: "Confirmation Overdue", paramKey: "confirmationStatus", value: "overdue", type: "red" },
      { label: "Contract Ending", paramKey: "contractEndingSoon", value: "30", type: "yellow" },
      // "Not Yet Confirmed" (confirmationStatus=not_confirmed) deliberately
      // left off -- unlike due_soon/overdue, it isn't due-date-bounded, so
      // it stays dropdown-only like the app's other non-time-boxed filters.
      { label: "Open Onboarding", paramKey: "lifecycleCase", value: "onboarding_open", type: "blue" },
      { label: "Open Offboarding", paramKey: "lifecycleCase", value: "offboarding_open", type: "blue" },
    ],
  };
}
