// Fixed, built-in onboarding checklist -- one hardcoded item set for every
// employee (see docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's scope
// decision #4: no admin-authored templates for v1). This is the source of
// truth for label/owner/sortOrder/milestone content -- the database
// (employee_lifecycle_case_items) only stores per-case state, keyed by
// `key` below. Kept manually in sync with
// supabase/functions/get_or_create_onboarding_case.sql's own seed list.
//
// `owner` is display-only here ("HR"/"IT"/"SUPERADMIN") -- the actual
// write-gating value lives in the database's owning_department_sub column
// (null for SUPERADMIN-owned items, since no department can write those).
//
// `milestone` groups items into the 4 rollup categories the employee's own
// self-service view (/app/employee/onboarding) collapses into -- a new
// hire doesn't need to read internal item labels verbatim.
export const ONBOARDING_MILESTONES = {
  PERSONAL_DETAILS: "Personal details received",
  ACCOUNT_SETUP: "Account & access being set up",
  DEVICE_HANDOVER: "Device/access-card handover",
  WELCOME: "Welcome & orientation",
};

export const ONBOARDING_CHECKLIST_ITEMS = [
  {
    key: "hr_documents_collected",
    label: "Personal details & statutory documents collected",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 1,
    milestone: "PERSONAL_DETAILS",
  },
  {
    key: "hr_onboarding_briefing",
    label: "HR onboarding briefing completed",
    owner: "HR",
    class: "MANUAL",
    sortOrder: 2,
    milestone: "PERSONAL_DETAILS",
  },
  {
    key: "workspace_account_created",
    label: "Google Workspace account created",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 3,
    milestone: "ACCOUNT_SETUP",
  },
  {
    key: "personal_email_notified",
    label: "New hire notified via personal email",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 4,
    milestone: "ACCOUNT_SETUP",
  },
  {
    key: "portal_invite_sent",
    label: "Portal invite sent to work email",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 5,
    milestone: "ACCOUNT_SETUP",
  },
  {
    key: "device_access_card_ready",
    label: "Device/access card prepared",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 6,
    milestone: "DEVICE_HANDOVER",
    appliesIf: "needs_it_asset",
  },
  {
    key: "it_asset_assigned",
    label: "IT asset assigned in system",
    owner: "IT",
    class: "DERIVED",
    sortOrder: 7,
    milestone: "DEVICE_HANDOVER",
    appliesIf: "needs_it_asset",
  },
  {
    key: "device_handed_over",
    label: "Device/access card handed over",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 8,
    milestone: "DEVICE_HANDOVER",
    appliesIf: "needs_it_asset",
  },
  {
    key: "it_onboarding_briefing",
    label: "IT onboarding briefing completed",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 9,
    milestone: "ACCOUNT_SETUP",
  },
  {
    key: "software_access_provisioned",
    label: "Software/system access provisioned",
    owner: "IT",
    class: "MANUAL",
    sortOrder: 10,
    milestone: "ACCOUNT_SETUP",
  },
  {
    key: "profile_linked",
    label: "Profile linked to employee record",
    owner: "HR",
    class: "DERIVED",
    sortOrder: 11,
    milestone: "WELCOME",
  },
  {
    key: "role_department_assigned",
    label: "Real role/department assigned",
    owner: "SUPERADMIN",
    class: "DERIVED",
    sortOrder: 12,
    milestone: "WELCOME",
  },
];
