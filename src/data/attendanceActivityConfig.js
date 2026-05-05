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
      required: true,
    },
    {
      key: "photo_url",
      label: "Attendance Photo",
      getValue: (activity) => activity.photo_url,
      editable: true,
      editor: "image",
      required: true,
    },
    // {
    //   key: "location",
    //   label: "Location",
    //   editable: true,
    //   editor: "text",
    //   required: selectedType?.requires_location || false,
    //   show: selectedType?.requires_location !== false,
    // },
    {
      key: "notes",
      label: "Notes",
      editable: true,
      editor: "text",
      required: false,
      show: true,
    },
  ];
}
