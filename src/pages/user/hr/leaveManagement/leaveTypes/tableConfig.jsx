// pages/user/hr/leaveManagement/leaveTypes/tableConfig.jsx
//
// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean
//
// Booleans use a Yes/No select -- there is no boolean editor in
// components/dataTable/editors/, and this is the established stand-in (see
// employeeLifecycle/detail/caseMetadataTableConfig.jsx).

const YES_NO = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

// NOT free text. leave_ledger_types.category is `not null` with
// `check (category in ('statutory_leave', 'business_activity'))` -- defined in
// hyrax-data-platform/infrastructure/leave_ledger_migration.sql, NOT in this
// repo, which is why it is easy to miss. A text input here would let HR type
// anything and get a raw 23514 constraint violation back.
const LEAVE_CATEGORIES = [
  { label: "Statutory Leave", value: "statutory_leave" },
  { label: "Business Activity", value: "business_activity" },
];

export const leaveTypeTableConfig = ({ creating = false } = {}) => [
  {
    key: "id",
    label: "ID",
    getValue: "id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    // EDITABLE ONLY ON CREATE. This is the key the leave sync matches on
    // (`lt.code = v.leave_type_raw`). Renaming it would orphan every entry
    // that used the old spelling, and the next sync would auto-create the
    // original code again as a second, unclassified type -- so a rename
    // quietly produces a duplicate rather than a correction.
    // leaveTypesService.updateLeaveType strips it server-side as a backstop.
    key: "code",
    label: "Code",
    getValue: "code",
    editable: creating,
    editor: "text",
    required: true,
  },
  {
    key: "label",
    label: "Label",
    getValue: "label",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    // Today this only groups types for reporting. The sync defaults every
    // auto-created type to statutory_leave, which is the status-quo-preserving
    // guess -- see sync_leave_ledger_rpc.sql section 2b.
    key: "category",
    label: "Category",
    getValue: "category",
    displayValue: (row) =>
      LEAVE_CATEGORIES.find((c) => c.value === row.category)?.label ||
      row.category ||
      "",
    editable: true,
    editor: "select",
    options: LEAVE_CATEGORIES,
    isSearchable: false,
    required: true,
  },
  {
    // THE FIELD THIS WHOLE TAB EXISTS FOR.
    //
    // It splits paidLeaveDaysTotal from unpaidLeaveDaysTotal in the payroll
    // package. The leave sync auto-creates unknown codes defaulting to PAID,
    // which is right more often than not but is exactly wrong for a new
    // no-pay type -- so until someone sets this correctly, unpaid leave is
    // being reported as paid.
    key: "is_paid",
    label: "Paid",
    getValue: "is_paid",
    displayValue: (row) => (row.is_paid ? "Paid" : "Unpaid"),
    editable: true,
    editor: "select",
    options: YES_NO,
    isSearchable: false,
    required: true,
  },
  {
    // Set true by the sync on every type it auto-creates, and by the seed on
    // types whose paid/unpaid classification was never confirmed with HR.
    // Sorting on it (see leaveTypesService.fetchAllLeaveTypes) is what makes
    // this tab a review queue: anything still flagged sits at the top.
    // HR clears it by setting this to No once Paid is correct.
    key: "needs_hr_confirmation",
    label: "Needs Review",
    getValue: "needs_hr_confirmation",
    displayValue: (row) => (row.needs_hr_confirmation ? "Yes" : ""),
    editable: true,
    editor: "select",
    options: YES_NO,
    isSearchable: false,
  },
  {
    // The evidence behind "Needs Review". Every seeded type carries its own
    // rationale here ("Genuinely ambiguous guess", "coin-flip guess",
    // "is_paid=false has real payroll consequences if wrong") -- so whoever
    // clears the flag can see what the original guess was based on, and
    // record what they confirmed it against.
    key: "notes",
    label: "Notes",
    getValue: "notes",
    editable: true,
    editor: "textarea",
    show: false,
  },
  {
    // Retirement, in place of deletion. leave_ledger_entries references this
    // table, so a type in use cannot be deleted -- and deleting an unused one
    // would only invite the next sync to recreate it from the source file.
    key: "is_active",
    label: "Active",
    getValue: "is_active",
    displayValue: (row) => (row.is_active ? "Active" : "Retired"),
    editable: true,
    editor: "select",
    options: YES_NO,
    isSearchable: false,
    required: true,
  },
];
