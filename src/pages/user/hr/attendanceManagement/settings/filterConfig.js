// pages/user/hr/attendanceManagement/settings/filterConfig.js
//
// Client-side only -- usePublicHolidays() always loads the whole calendar in
// one shot (no pagination), so these filters run in a useMemo over the
// already-fetched array (see AttendanceSettings.jsx), not against a
// service/RPC parameter.
export function getHolidaysFilterConfig({ workLocations }) {
  return [
    {
      key: "category",
      label: "Category",
      options: [
        { label: "National", value: "national" },
        { label: "State", value: "state" },
        { label: "Company", value: "company" },
      ],
    },
    {
      key: "workLocation",
      label: "Work Location",
      options: (workLocations || []).map((w) => ({
        label: w.name,
        value: String(w.id),
      })),
    },
  ];
}
