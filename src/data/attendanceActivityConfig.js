export function attendanceActivityConfig({
  attendanceTypes = [],
  selectedTypeId = null,
}) {
  const selectedType = attendanceTypes.find((a) => a.id === selectedTypeId);

  return [
    {
      key: "attendance_type_id",
      label: "Attendance Type",
      editable: true,
      editor: "select",
      options: attendanceTypes.map((a) => ({
        label: a.name,
        value: a.id,
      })),
    },
    {
      key: "photo_url",
      label: "Photo URL",
      editable: true,
      editor: "text", // Placeholder for now
      required: selectedType?.requires_photo || false,
      visible: selectedType?.requires_photo !== false,
    },
    {
      key: "location",
      label: "Location",
      editable: true,
      editor: "text",
      required: selectedType?.requires_location || false,
      visible: selectedType?.requires_location !== false,
    },
    {
      key: "notes",
      label: "Notes",
      editable: true,
      editor: "text",
      required: false,
      visible: true,
    },
  ];
}
