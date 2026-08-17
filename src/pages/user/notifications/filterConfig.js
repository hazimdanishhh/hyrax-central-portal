// No metadata table behind this one -- read_status is a plain boolean
// column, so options are fixed rather than loaded async (unlike role/
// department-style filters elsewhere).
export function getNotificationsFilterConfig() {
  return [
    {
      key: "read_status",
      label: "Status",
      options: [
        { label: "Unread", value: "false" },
        { label: "Read", value: "true" },
      ],
    },
  ];
}
