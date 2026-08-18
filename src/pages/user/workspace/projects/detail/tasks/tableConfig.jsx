// pages/user/workspace/projects/detail/tasks/tableConfig.jsx
import StatusBox from "../../../../../../components/status/statusBox/StatusBox";
import {
  TASK_STATUSES,
  TASK_STATUS_TYPE,
} from "../../../../../../features/workspace/tasks/private/taskStatusMeta";

/**
 * Factory function. `canEdit` (from taskPermissions.isTaskAssignee, per
 * req #6 -- only a task's own assignees can edit it) sets most fields'
 * `editable` uniformly (status is the one exception -- always
 * non-editable/hidden here regardless of `canEdit`, since it only ever
 * changes via TaskCard's guarded quick-action buttons now, never this
 * form); combined with the sidebar's own `cannotUpdate` prop (hides Save
 * entirely), this needs ZERO changes to DataTable/DataForm/DataTableCell --
 * both mechanisms already exist, just never had a caller before this
 * module.
 *
 * `workingMembers` (owner/lead/member roles only, never cc) scopes the
 * assignee picker's options to req #5's actual constraint in the UI, on
 * top of the DB trigger that enforces it regardless.
 *
 * `canAttachDocuments` is deliberately separate from `canEdit`: attaching a
 * document is allowed for any WORKING project member (task_documents_crud.sql),
 * a looser tier than "is this task's own assignee" (tasks_crud.sql's UPDATE
 * policy) -- so a working member who isn't assigned to this task can still
 * have the documents field editable while every other field stays read-only.
 * Defaults to `canEdit` so callers that don't care about the distinction
 * (e.g. the Add Task form, where everyone able to open it is already a
 * working member) don't need to pass it explicitly.
 *
 * `projectDocuments` (the project's existing document library, from
 * useProjectDocuments) is offered by the documents editor as "link an
 * existing document" options, separate from attaching a brand-new file.
 */
export const taskTableConfig = ({
  workingMembers = [],
  canEdit = true,
  canAttachDocuments = canEdit,
  projectDocuments = [],
}) => {
  const assigneeOptions = workingMembers.map((m) => ({
    label: m.employee?.full_name,
    value: m.employee_id,
    avatarUrl: m.employee?.avatar_url,
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
      displayValue: (task) =>
        TASK_STATUSES.find((s) => s.value === task.status)?.label,
      // Status only ever changes via TaskCard's quick-action buttons now --
      // computed:true (not just show:false) stops DataForm from seeding or
      // submitting this field at all, so the Add Task form can never
      // submit status:null (which would violate tasks.status's NOT NULL
      // constraint) -- see progress_percentage's identical precedent.
      computed: true,
      show: false,
      editable: false,
      isSearchable: false,
      render: (_displayValue, task) => (
        <StatusBox
          status={
            TASK_STATUSES.find((s) => s.value === task.status)?.label ||
            task.status
          }
          type={TASK_STATUS_TYPE[task.status] || "grey"}
        />
      ),
      half: true,
    },
    {
      key: "start_date",
      label: "Start Date",
      getValue: "start_date",
      editable: canEdit,
      editor: "date",
      half: true,
    },
    {
      key: "due_date",
      label: "Due Date",
      getValue: "due_date",
      editable: canEdit,
      editor: "date",
      half: true,
    },
    {
      key: "completed_date",
      label: "Completed Date",
      getValue: "completed_date",
      editable: canEdit,
      editor: "date",
      half: true,
    },
    {
      key: "assignee_ids",
      label: "Assignees",
      getValue: (task) => (task.task_assignees ?? []).map((a) => a.employee_id),
      displayValue: (task) =>
        (task.task_assignees ?? [])
          .map((a) => a.employee?.full_name)
          .filter(Boolean)
          .join(", "),
      editable: canEdit,
      editor: "employeeMultiSelect",
      options: assigneeOptions,
      required: true,
    },
    {
      key: "description",
      label: "Description",
      getValue: "description",
      editable: canEdit,
      editor: "textarea",
      section: "Details",
    },
    {
      key: "documents",
      label: "Attached Documents",
      getValue: (task) =>
        (task.task_documents ?? []).map((td) => ({
          document_id: td.document_id,
          drive_file_id: td.document?.drive_file_id,
          name: td.document?.name,
          url: td.document?.url,
          mime_type: td.document?.mime_type,
          icon_url: td.document?.icon_url,
        })),
      editable: canAttachDocuments,
      editor: "taskDocuments",
      options: projectDocuments,
      section: "Documents",
    },
  ];
};
