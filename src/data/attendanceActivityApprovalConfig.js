export function attendanceActivityApprovalConfig({
  attendanceTypes = [],
  selectedTypeId = null,
}) {
  const selectedType = attendanceTypes.find((a) => a.id === selectedTypeId);

  return [
    {
      key: "attendance_type_id",
      label: "Attendance Type",
      editable: false,
      editor: "select",
      options: attendanceTypes.map((a) => ({
        label: a.name,
        value: a.id,
      })),
      required: true,
    },
    {
      key: "photo_url",
      label: "Photo URL",
      editable: false,
      editor: "text", // Placeholder for now
      // required: selectedType?.requires_photo || false,
      // visible: selectedType?.requires_photo !== false,
      required: true,
    },
    {
      key: "location",
      label: "Location",
      editable: false,
      editor: "text",
      required: selectedType?.requires_location || false,
      visible: selectedType?.requires_location !== false,
    },
    {
      key: "notes",
      label: "Notes",
      editable: false,
      editor: "text",
      required: false,
      visible: true,
    },
    {
      key: "approval_status",
      label: "Approval Status",
      editable: true,
      editor: "select",
      options: ["Pending", "Approved", "Rejected"],
      required: false,
      visible: true,
    },
  ];
}
