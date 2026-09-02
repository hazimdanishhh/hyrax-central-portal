// employeesTableConfig.jsx

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

import StatusBox from "../../../../../components/status/statusBox/StatusBox";
import {
  CASE_TYPE_LABEL,
  CASE_TYPE_BADGE_TYPE,
} from "../../../../../features/employeeLifecycle/private/lifecycleCaseStatusMeta";

// `isSuperAdmin` gates raw editing of resignation_date/termination_reason_id
// only -- see docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 2 and
// its UAT readiness pass. Both are purely departure-specific with a guided
// alternative (the status-transition buttons on EmployeeSidebar.jsx) for
// the normal path, so they stay visible (read-only) in the plain form for
// HR, directly editable only for superadmin, as a correction/backfill
// escape hatch -- mirrors how Sales Leads/Tasks removed raw status editing
// once a guided flow existed, but deliberately keeps a raw-edit path open
// here (unlike those two modules) since Employee Management is also a
// system of record that needs to absorb historical corrections, not just a
// forward-moving process tracker.
//
// employment_status_id/end_date were ALSO superadmin-gated in that same
// pass, then reverted -- this same tableConfig drives both the create AND
// edit forms, and gating them broke two things with no guided alternative:
// a non-superadmin HR user could no longer set a brand-new hire's initial
// status at all (silently landing as NULL on insert, which breaks
// handle_employee_onboarding_case_open.sql's guard -- see the UAT
// readiness pass), and there's no guided button for routine
// Probation-confirmation/Suspend/Reinstate/Leave transitions by explicit
// prior decision (employeeStatusTransitions.js's own header) -- so gating
// employment_status_id blocked those too, not just departures. end_date is
// ordinary data-entry for a new contract/non-full-time hire, unrelated to
// the guided offboarding flow. Both stay fully editable.
export const employeesTableConfig = ({
  managers,
  profiles,
  departments,
  nationalities,
  identificationTypes,
  employmentTypes,
  terminationReasons,
  employmentStatuses,
  isSuperAdmin = false,
}) => [
  {
    key: "id",
    label: "ID",
    getValue: (employee) => employee.id,
    editable: false,
    editor: "text",
    show: false,
  },
  // LIFECYCLE CASE -- computed/non-editable, see
  // docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md. computed:true keeps
  // DataForm from ever seeding/submitting it (see DataForm.jsx's
  // getDefaultValues) since it's a query-time embed, not a real column on
  // employees -- PostgREST rejects it outright otherwise (PGRST204).
  // show:false additionally hides it from the create/edit form's rendered
  // fields; DataTable never reads `show`, so it still renders here via
  // `render`.
  {
    key: "lifecycle_cases",
    label: "Lifecycle Case",
    getValue: (employee) => employee.lifecycle_cases,
    editable: false,
    computed: true,
    show: false,
    render: (_displayValue, employee) => {
      const cases = employee.lifecycle_cases ?? [];
      if (!cases.length) return <span className="textLight textXXS">—</span>;
      return cases.map((c) => (
        <StatusBox
          key={c.id}
          status={CASE_TYPE_LABEL[c.case_type]}
          type={CASE_TYPE_BADGE_TYPE[c.case_type]}
        />
      ));
    },
  },
  // SYSTEM SETTINGS
  {
    key: "profile_id",
    label: "Profile",
    getValue: (employee) => employee.profile_id,
    editable: true,
    editor: "select",
    options: profiles.map((p) => ({
      label: p.email,
      value: p.id,
    })),
    section: "System Settings",
  },

  // PERSONAL INFORMATION
  {
    key: "full_name",
    label: "Full Name",
    getValue: (employee) => employee.full_name,
    editable: true,
    editor: "text",
    required: true,
    section: "Personal Information",
  },
  {
    key: "preferred_name",
    label: "Preferred Name",
    getValue: (employee) => employee.preferred_name,
    editable: true,
    editor: "text",
    section: "Personal Information",
  },
  {
    key: "date_of_birth",
    label: "Date of Birth",
    getValue: (employee) => employee.date_of_birth,
    editable: true,
    editor: "date",
    section: "Personal Information",
    half: true,
  },
  {
    key: "gender",
    label: "Gender",
    getValue: (employee) => employee.gender,
    editable: true,
    editor: "select",
    options: [
      {
        label: "Male",
        value: "Male",
      },
      {
        label: "Female",
        value: "Female",
      },
      { label: "Not Specified", value: "Not Specified" },
    ],
    isSearchable: false,
    section: "Personal Information",
    half: true,
  },
  {
    key: "nationality_id",
    label: "Nationality",
    getValue: (employee) => employee.nationality?.id,
    displayValue: (employee) => employee.nationality?.name,
    editable: true,
    editor: "select",
    options: nationalities.map((n) => ({
      label: n.name,
      value: n.id,
    })),
    section: "Personal Information",
  },
  {
    key: "identification_type_id",
    label: "Identification Type",
    getValue: (employee) => employee.identification_type?.id,
    displayValue: (employee) => employee.identification_type?.name,
    editable: true,
    editor: "select",
    options: identificationTypes.map((i) => ({
      label: i.name,
      value: i.id,
    })),
    isSearchable: false,
    section: "Personal Information",
    half: true,
  },
  {
    key: "identification_number",
    label: "Identification Number",
    getValue: (employee) => employee.identification_number,
    editable: true,
    editor: "text",
    section: "Personal Information",
    half: true,
  },
  {
    key: "marital_status",
    label: "Marital Status",
    getValue: (employee) => employee.marital_status,
    editable: true,
    editor: "select",
    options: [
      { label: "Single", value: "Single" },
      {
        label: "Married (Spouse Not Working)",
        value: "Married (Spouse Not Working)",
      },
      {
        label: "Married (Spouse Working)",
        value: "Married (Spouse Working)",
      },
      {
        label: "Divorced",
        value: "Divorced",
      },
      {
        label: "Widowed",
        value: "Widowed",
      },
    ],
    isSearchable: false,
    section: "Personal Information",
  },

  // CONTACT INFORMATION
  {
    key: "email_personal",
    label: "Email (Personal)",
    getValue: (employee) => employee.email_personal,
    editable: true,
    editor: "text",
    section: "Contact Information",
    half: true,
  },
  {
    key: "email_work",
    label: "Email (Work)",
    getValue: (employee) => employee.email_work,
    editable: true,
    editor: "text",
    section: "Contact Information",
    half: true,
  },
  {
    key: "phone_personal",
    label: "Phone (Personal)",
    getValue: (employee) => employee.phone_personal,
    editable: true,
    editor: "number",
    section: "Contact Information",
    half: true,
  },
  {
    key: "phone_work",
    label: "Phone (Work)",
    getValue: (employee) => employee.phone_work,
    editable: true,
    editor: "number",
    section: "Contact Information",
    half: true,
  },
  {
    key: "emergency_contact_name",
    label: "Emergency Contact Name",
    getValue: (employee) => employee.emergency_contact_name,
    editable: true,
    editor: "text",
    section: "Contact Information",
  },
  {
    key: "emergency_contact_relationship",
    label: "Emergency Contact Relationship",
    getValue: (employee) => employee.emergency_contact_relationship,
    editable: true,
    editor: "select",
    options: [
      {
        label: "Parent",
        value: "Parent",
      },
      {
        label: "Spouse",
        value: "Spouse",
      },
      { label: "Sibling", value: "Sibling" },
      { label: "Child", value: "Child" },
      { label: "Friend", value: "Friend" },
      { label: "Other", value: "Other" },
    ],
    isSearchable: false,
    section: "Contact Information",
  },
  {
    key: "emergency_contact_phone",
    label: "Emergency Contact Phone",
    getValue: (employee) => employee.emergency_contact_phone,
    editable: true,
    editor: "number",
    section: "Contact Information",
  },

  // EMPLOYMENT DETAILS
  {
    key: "employee_id",
    label: "Employee ID",
    getValue: (employee) => employee.employee_id,
    editable: true,
    editor: "text",
    section: "Personal Information",
  },
  {
    key: "department_id",
    label: "Department",
    getValue: (employee) => employee.department?.id,
    displayValue: (employee) => employee.department?.name,
    editable: true,
    editor: "select",
    options: departments.map((d) => ({
      label: d.name,
      value: d.id,
    })),
    section: "Employment Details",
  },
  {
    key: "position",
    label: "Position",
    getValue: (employee) => employee.position,
    editable: true,
    editor: "text",
    section: "Employment Details",
  },
  {
    key: "employment_status_id",
    label: "Employment Status",
    getValue: (employee) => employee.employment_status?.id,
    displayValue: (employee) => employee.employment_status?.name,
    editable: true,
    editor: "select",
    options: employmentStatuses.map((e) => ({
      label: e.name,
      value: e.id,
    })),
    required: true,
    isSearchable: false,
    section: "Employment Details",
    half: true,
  },
  {
    key: "employment_type_id",
    label: "Employment Type",
    getValue: (employee) => employee.employment_type?.id,
    displayValue: (employee) => employee.employment_type?.name,
    editable: true,
    editor: "select",
    options: employmentTypes.map((e) => ({
      label: e.name,
      value: e.id,
    })),
    isSearchable: false,
    section: "Employment Details",
    half: true,
  },
  // Tri-state, not a plain boolean -- null means "not yet decided" (every
  // existing employee row has this on migration day, and a plain false
  // default would be indistinguishable from an explicit "doesn't need
  // one"). Drives the onboarding checklist's 3 device/access-card items
  // (see src/data/onboardingChecklistMeta.js) -- without this field, HR
  // has no way to ever set it, and those items always seed SKIPPED. See
  // docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Section B.
  {
    key: "needs_it_asset",
    label: "Require Device / Access Card?",
    getValue: (employee) => employee.needs_it_asset,
    editable: true,
    editor: "select",
    options: [
      { label: "Not Decided", value: null },
      { label: "Needed", value: true },
      { label: "Not Needed", value: false },
    ],
    isSearchable: false,
    section: "Employment Details",
  },

  {
    key: "join_date",
    label: "Join Date",
    getValue: (employee) => employee.join_date,
    editable: true,
    editor: "date",
    section: "Employment Details",
    half: true,
  },
  {
    key: "confirmation_date",
    label: "Confirmation Date",
    getValue: (employee) => employee.confirmation_date,
    editable: true,
    editor: "date",
    section: "Employment Details",
    half: true,
  },
  {
    key: "end_date",
    label: "Contract End Date",
    getValue: (employee) => employee.end_date,
    editable: true,
    editor: "date",
    section: "Employment Details",
    half: true,
  },
  {
    key: "resignation_date",
    label: "Resignation Date",
    getValue: (employee) => employee.resignation_date,
    editable: isSuperAdmin,
    editor: "date",
    section: "Employment Details",
    half: true,
  },
  {
    key: "termination_reason_id",
    label: "Termination Reason",
    getValue: (employee) => employee.termination_reason?.id,
    displayValue: (employee) => employee.termination_reason?.name,
    editable: isSuperAdmin,
    editor: "select",
    options: terminationReasons.map((t) => ({
      label: t.name,
      value: t.id,
    })),
    isSearchable: false,
    section: "Employment Details",
  },

  // REPORTING MANAGER
  {
    key: "manager_id",
    label: "Manager",
    getValue: (employee) => employee.manager?.id,
    displayValue: (employee) => employee.manager?.full_name,
    editable: true,
    editor: "select",
    options: managers.map((m) => ({
      label: m.full_name,
      value: m.id,
    })),
    section: "Reporting Manager",
  },

  // ADDRESS INFORMATION
  {
    key: "address_work",
    label: "Address (Work)",
    getValue: (employee) => employee.address_work,
    editable: true,
    editor: "text",
    section: "Address Information",
  },
  {
    key: "address_personal",
    label: "Address (Personal)",
    getValue: (employee) => employee.address_personal,
    editable: true,
    editor: "text",
    section: "Address Information",
  },
];
