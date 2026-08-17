// Single source of truth for the 4-tier project_members.role check
// constraint -- imported by the Members tab's role picker/badges and the
// "Add Project"/"Add Members" forms' role-grouped multi-selects.
export const PROJECT_ROLES = [
  { label: "Owner", value: "owner" },
  { label: "Lead", value: "lead" },
  { label: "Member", value: "member" },
  { label: "CC", value: "cc" },
];

// Roles assignable via the ordinary membership-management UI -- 'owner'
// is deliberately excluded, since it can only ever move via Transfer
// Ownership (transfer_project_ownership RPC), never a plain role change.
export const ASSIGNABLE_PROJECT_ROLES = PROJECT_ROLES.filter((r) => r.value !== "owner");

export const PROJECT_ROLE_LABEL = Object.fromEntries(PROJECT_ROLES.map((r) => [r.value, r.label]));
