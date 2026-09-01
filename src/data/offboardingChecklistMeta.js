// Fixed, built-in offboarding checklist -- see onboardingChecklistMeta.js's
// own header for the general shape/rationale; kept manually in sync with
// supabase/functions/get_or_create_offboarding_case.sql's own seed list.
//
// `employeeVisible` matches docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's
// worked recommendation table exactly -- it's ALSO enforced server-side via
// employee_lifecycle_case_items.employee_visible (stamped from this same
// value at seed time), so this isn't just a frontend display choice; RLS
// independently blocks a departing employee from reading a
// non-employee-visible item even via a direct API call.
export const OFFBOARDING_CHECKLIST_ITEMS = [
  {
    key: "resignation_acknowledged",
    label: "Resignation/notice acknowledged, last day confirmed",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 1,
    employeeVisible: false,
  },
  {
    key: "exit_interview_completed",
    label: "Exit interview completed",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 2,
    employeeVisible: true,
  },
  {
    key: "handover_plan_documented",
    label: "Handover plan documented",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 3,
    employeeVisible: false,
  },
  {
    key: "leave_balance_settled",
    label: "Leave balance settled",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 4,
    employeeVisible: true,
  },
  {
    key: "final_settlement_processed",
    label: "Final settlement processed",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 5,
    employeeVisible: true,
  },
  {
    key: "statutory_benefits_cessation",
    label: "Statutory benefits cessation notified",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 6,
    employeeVisible: true,
  },
  {
    key: "certificate_of_service_issued",
    label: "Certificate of service issued",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 7,
    employeeVisible: true,
  },
  {
    key: "employee_file_closed",
    label: "Employee file closed",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 8,
    employeeVisible: true,
  },
  {
    key: "it_assets_returned",
    label: "IT assets returned",
    owner: "IT",
    class: "DERIVED",
    sortOrder: 9,
    employeeVisible: true,
    appliesIf: "hadAssignedAssets",
  },
  {
    key: "software_access_revoked",
    label: "Software/system access revoked",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 10,
    employeeVisible: false,
  },
  {
    key: "workspace_account_revoked",
    label: "Google Workspace account revoked",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 11,
    employeeVisible: false,
  },
  {
    key: "credentials_rotated",
    label: "Shared/admin credentials rotated",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 12,
    employeeVisible: false,
    appliesIf: "elevatedRoleOrItFinDepartment",
  },
  {
    key: "portal_account_deactivated",
    label: "Portal account deactivated",
    owner: "IT",
    class: "DERIVED",
    sortOrder: 13,
    employeeVisible: false,
  },
];
