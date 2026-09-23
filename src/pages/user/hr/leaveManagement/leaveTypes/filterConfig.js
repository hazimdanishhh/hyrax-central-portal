// pages/user/hr/leaveManagement/leaveTypes/filterConfig.js
//
// Client-side only -- fetchAllLeaveTypes() loads the whole vocabulary in one
// shot (it is a few dozen rows, not a paginated dataset), so these run in a
// useMemo over the already-fetched array in LeaveTypes.jsx, not as a service
// parameter. Same arrangement as the public holiday calendar's filterConfig.
export function getLeaveTypesFilterConfig() {
  return [
    {
      // The review-queue filter. The sync auto-creates unknown codes with
      // needs_hr_confirmation = true and is_paid = true, so anything sitting
      // in "Needs Review" is a type currently being REPORTED AS PAID that
      // nobody has confirmed is paid.
      key: "needsReview",
      label: "Review Status",
      options: [
        { label: "Needs Review", value: "yes" },
        { label: "Confirmed", value: "no" },
      ],
    },
    {
      key: "isPaid",
      label: "Paid",
      options: [
        { label: "Paid", value: "yes" },
        { label: "Unpaid", value: "no" },
      ],
    },
    {
      // Defaults to no filter, so retired types are visible -- HR has to be
      // able to find one to reactivate it. Deletion is not offered anywhere
      // (leave_ledger_entries references this table), so is_active is the
      // only retirement path and hiding it by default would hide the undo.
      key: "isActive",
      label: "Status",
      options: [
        { label: "Active", value: "yes" },
        { label: "Retired", value: "no" },
      ],
    },
  ];
}
