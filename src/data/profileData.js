export const profileData = [
  {
    title: "System Settings",
    source: "profile",
    fields: [
      { label: "Display Name", value: (d) => d?.full_name },
      { label: "System Email", value: (d) => d?.email },
      { label: "System Role", value: (d) => d?.role },
      {
        label: "Module Access",
        value: (d) => `${d?.department} (${d?.departmentSub})`,
      },
      { label: "User ID", value: (d) => d?.id },
    ],
  },

  {
    title: "Personal Information",
    source: "employee",
    fields: [
      { label: "Full Name", value: (d) => d?.full_name },
      { label: "Preferred Name", value: (d) => d?.preferred_name },
      { label: "Date of Birth", value: (d) => d?.date_of_birth },
      { label: "Gender", value: (d) => d?.gender },
      { label: "Nationality", value: (d) => d?.nationality },
      { label: "Identification Type", value: (d) => d?.identification_type },
      {
        label: "Identification Number",
        value: (d) => d?.identification_number,
      },
      { label: "Marital Status", value: (d) => d?.marital_status },
    ],
  },

  {
    title: "Contact Information",
    source: "employee",
    fields: [
      { label: "Email (Personal)", value: (d) => d?.email_personal },
      { label: "Email (Work)", value: (d) => d?.email_work },
      { label: "Phone (Personal)", value: (d) => d?.phone_personal },
      { label: "Phone (Work)", value: (d) => d?.phone_work },
      {
        label: "Emergency Contact Name",
        value: (d) => d?.emergency_contact_name,
      },
      {
        label: "Emergency Contact Relationship",
        value: (d) => d?.emergency_contact_relationship,
      },
      {
        label: "Emergency Contact Phone",
        value: (d) => d?.emergency_contact_phone,
      },
    ],
  },

  {
    title: "Employment Details",
    source: "employee",
    fields: [
      { label: "Employee ID", value: (d) => d?.employee_id },
      {
        label: "Department",
        value: (d) => `${d?.department?.name} (${d?.department?.sub})`,
      },
      { label: "Position", value: (d) => d?.position },
      { label: "Manager System ID", value: (d) => d?.manager?.id },
      {
        label: "Reporting Manager",
        value: (d) => d?.manager?.full_name,
      },
      { label: "Manager Email", value: (d) => d?.manager?.email },
      { label: "Employment Status", value: (d) => d?.employment_status },
      { label: "Employment Type", value: (d) => d?.employment_type },
      { label: "Join Date", value: (d) => d?.join_date },
      { label: "Confirmation Date", value: (d) => d?.confirmation_date },
      { label: "End Date", value: (d) => d?.end_date },
      { label: "Resignation Date", value: (d) => d?.resignation_date },
      { label: "Termination Reason", value: (d) => d?.termination_reason },
    ],
  },

  {
    title: "Address Information",
    source: "employee",
    fields: [
      { label: "Address (Work)", value: (d) => d?.address_work },
      { label: "Address (Home)", value: (d) => d?.address_personal },
    ],
  },
];
