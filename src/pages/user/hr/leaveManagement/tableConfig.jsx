// Read-only display columns for leave_ledger_entries (joined to
// leave_ledger_types) -- HR2000 remains the system of record, so this page
// never edits rows directly; the weekly CSV sync is the only write path.
export function leaveRecordsTableConfig() {
  return [
    {
      key: "employee",
      label: "Employee",
      getValue: (row) => row.employee?.full_name || row.employee_code,
    },
    {
      key: "employee_code",
      label: "Employee Code",
      getValue: (row) => row.employee_code,
    },
    {
      key: "leave_date",
      label: "Date",
      getValue: (row) => row.leave_date,
    },
    {
      key: "leave_type",
      label: "Type",
      getValue: (row) => row.leave_type?.label || row.leave_type_code,
    },
    {
      key: "day_fraction",
      label: "Days",
      getValue: (row) => row.day_fraction,
    },
    {
      key: "remarks",
      label: "Remarks",
      getValue: (row) => row.remarks,
    },
    {
      key: "last_seen_at",
      label: "Last Synced",
      getValue: (row) =>
        row.last_seen_at ? new Date(row.last_seen_at).toLocaleString() : "",
    },
  ];
}
