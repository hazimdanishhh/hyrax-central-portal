// pages/user/workspace/projects/detail/tasks/tableConfig.jsx
import StatusBox from "../../../../../../components/status/statusBox/StatusBox";
import { TASK_STATUSES, TASK_STATUS_TYPE } from "../../../../../../features/workspace/tasks/private/taskStatusMeta";

/**
 * Factory function. `canEdit` (from taskPermissions.isTaskAssignee, per
 * req #6 -- only a task's own assignees can edit it) sets every field's
 * `editable` uniformly; combined with the sidebar's own `cannotUpdate`
 * prop (hides Save entirely), this needs ZERO changes to
 * DataTable/DataForm/DataTableCell -- both mechanisms already exist,
 * just never had a caller before this module.
 *
 * `workingMembers` (owner/lead/member roles only, never cc) scopes the
 * assignee picker's options to req #5's actual constraint in the UI, on
 * top of the DB trigger that enforces it regardless.
 */
export const taskTableConfig = ({ workingMembers = [], canEdit = true }) => {
  const assigneeOptions = workingMembers.map((m) => ({
    label: m.employee?.full_name,
    value: m.employee_id,
  }));

  return [
    {
      key: "id",
      label: "ID",
      getValue: "id",
      editable: false,
      show: false,
    },
    {
      key: "project_id",
      label: "Project",
      getValue: "project_id",
      editable: false,
      show: false,
    },
    {
      key: "title",
      label: "Task Title",
      getValue: "title",
      editable: canEdit,
      editor: "text",
      required: true,
    },
    {
      key: "status",
      label: "Status",
      getValue: "status",
      displayValue: (task) => TASK_STATUSES.find((s) => s.value === task.status)?.label,
      editable: canEdit,
      editor: "select",
      options: TASK_STATUSES,
      isSearchable: false,
      render: (_displayValue, task) => (
        <StatusBox
          status={TASK_STATUSES.find((s) => s.value === task.status)?.label || task.status}
          type={TASK_STATUS_TYPE[task.status] || "grey"}
        />
      ),
    },
    {
      key: "due_date",
      label: "Due Date",
      getValue: "due_date",
      editable: canEdit,
      editor: "date",
    },
    {
      key: "assignee_ids",
      label: "Assignees",
      getValue: (task) => (task.task_assignees ?? []).map((a) => a.employee_id),
      displayValue: (task) =>
        (task.task_assignees ?? []).map((a) => a.employee?.full_name).filter(Boolean).join(", "),
      editable: canEdit,
      editor: "multiSelect",
      options: assigneeOptions,
    },
    {
      key: "description",
      label: "Description",
      getValue: "description",
      editable: canEdit,
      editor: "textarea",
      section: "Details",
    },
  ];
};
