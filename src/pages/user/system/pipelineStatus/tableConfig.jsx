// pages/user/system/pipelineStatus/tableConfig.jsx
import StatusBox from "../../../../components/status/statusBox/StatusBox";
import { formatDateTime, formatRelativeTime } from "../../../../functions/formatDate";

// Read-only -- both tables are pipeline-owned (sap_pipeline_state,
// pipeline_run_log), never edited from this app.

export const pipelineCurrentStateTableConfig = () => [
  {
    key: "pipeline_name",
    label: "Pipeline",
    getValue: (row) => row.pipeline_name,
    editable: false,
  },
  {
    key: "last_run_at",
    label: "Last Successful Run",
    getValue: (row) => formatDateTime(row.last_run_at) || "—",
    editable: false,
  },
  {
    key: "last_run_relative",
    label: "How Long Ago",
    getValue: (row) => formatRelativeTime(row.last_run_at) || "—",
    editable: false,
  },
  {
    key: "rows_extracted",
    label: "Rows (Last Run)",
    getValue: (row) => row.rows_extracted ?? "—",
    editable: false,
  },
];

const STATUS_TYPES = {
  success: "green",
  error: "red",
};

export const pipelineRunLogTableConfig = () => [
  {
    key: "pipeline_name",
    label: "Pipeline",
    getValue: (row) => row.pipeline_name,
    editable: false,
  },
  {
    key: "run_at",
    label: "Run At",
    getValue: (row) => formatDateTime(row.run_at),
    editable: false,
  },
  {
    key: "status",
    label: "Status",
    getValue: (row) => row.status,
    editable: false,
    // DataTableCell renders !editable columns inside a disabled <input>,
    // which can't hold JSX -- `render` is the escape hatch for a real
    // component, checked before that fallback.
    render: (_displayValue, row) => (
      <StatusBox
        status={row.status}
        type={STATUS_TYPES[row.status] || "grey"}
      />
    ),
  },
  {
    key: "rows_extracted",
    label: "Rows",
    getValue: (row) => row.rows_extracted ?? "—",
    editable: false,
  },
  {
    key: "duration_seconds",
    label: "Duration",
    getValue: (row) =>
      row.duration_seconds != null ? `${row.duration_seconds.toFixed(1)}s` : "—",
    editable: false,
  },
  {
    key: "error_message",
    label: "Error",
    getValue: (row) => row.error_message || "—",
    editable: false,
  },
];
