// Date-range filtering (startDate/endDate on leave_date) is handled by
// SearchFilterBar's enableDateRange prop directly -- no config entry needed
// for it, same convention as every other enableDateRange-powered page.
export function getLeaveRecordsFilterConfig({ leaveTypes }) {
  return [
    {
      key: "leaveType",
      label: "Leave Type",
      options: leaveTypes.map((t) => ({ label: t.label, value: t.id })),
    },
  ];
}
