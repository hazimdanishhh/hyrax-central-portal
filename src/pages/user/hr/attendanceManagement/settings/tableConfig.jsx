// pages/user/hr/attendanceManagement/settings/tableConfig.jsx

// key = actual database field name
// label = UI name
// getValue = data name
// editor = data type
// options = for option input
// editable = boolean

export const publicHolidayTableConfig = ({ workLocations }) => [
  {
    key: "id",
    label: "ID",
    getValue: "id",
    editable: false,
    editor: "text",
    show: false,
  },
  {
    key: "holiday_date",
    label: "Date",
    getValue: "holiday_date",
    editable: true,
    editor: "date",
    required: true,
  },
  {
    key: "name",
    label: "Name",
    getValue: "name",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    key: "code",
    label: "Code",
    getValue: "code",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    key: "category",
    label: "Category",
    getValue: "category",
    editable: true,
    editor: "select",
    required: true,
    options: [
      { label: "National", value: "national" },
      { label: "State", value: "state" },
      { label: "Company", value: "company" },
    ],
    isSearchable: false,
  },
  {
    key: "work_location_id",
    label: "Work Location",
    getValue: (row) => row.work_location?.id ?? null,
    displayValue: (row) => row.work_location?.name || "All Locations",
    editable: true,
    editor: "select",
    // Nullable -- NULL means this holiday applies to every work location
    // (national statutory holidays, company-wide off-days). Only a
    // genuinely state-specific holiday needs a real location picked.
    options: [
      { label: "All Locations", value: null },
      ...workLocations.map((wl) => ({ label: wl.name, value: wl.id })),
    ],
    isSearchable: false,
  },
];
