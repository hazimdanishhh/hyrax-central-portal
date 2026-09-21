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
      // LIVE clock-in only shows self-selectable types. Office and Blending
      // Plant are scanner-only by policy (see
      // docs/hr/ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md: you are either badged
      // in at a company site or clocked in remotely through the app, never
      // both for the same moment) -- they exist as rows purely so a
      // failed-scanner day can be reconciled afterwards through the backfill
      // form, which deliberately does NOT apply this filter.
      //
      // Filtered HERE rather than in useAttendanceTypes.js / the metadata
      // service, because those also feed HR's timeline Edit form, which must
      // keep the full list for exactly that reconciliation case.
      //
      // `!== false` rather than `=== true`: tolerates a row created before the
      // is_self_selectable column existed, where the value could be undefined
      // in a cached response.
      options: attendanceTypes
        .filter((a) => a.is_self_selectable !== false)
        .map((a) => ({
          label: a.name,
          value: a.id,
        })),
      required: true,
    },
    // {
    //   key: "photo_url",
    //   label: "Attendance Photo",
    //   getValue: (activity) => activity.photo_url,
    //   editable: true,
    //   editor: "image",
    //   required: true,
    // },
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
