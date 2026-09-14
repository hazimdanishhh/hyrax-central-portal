// pages/user/workspace/tasks/list/tableConfig.jsx
import { Link } from "react-router";
import { TASK_STATUSES } from "../../../../../features/workspace/tasks/private/taskStatusMeta";

/**
 * A slimmer variant of the project Tasks tab's tableConfig -- no
 * assignees field, since reassigning who's on a task is a
 * project-membership-aware action best done from that project's own
 * Tasks tab (where the roster is already loaded), not from this
 * cross-project personal list. Title/due date/start date/completed date
 * are always editable here -- every row shown is, by definition, one the
 * viewer is assigned to (myTasksService.js's !inner filter guarantees
 * this), so no per-row gating logic is needed on this page at all. Status
 * is NOT editable here -- it only ever changes via TaskCard's guarded
 * Start/Complete/Cancel/Revert quick-actions (see taskStatusMeta.js), never
 * a free-form dropdown in this form.
 *
 * `projectDocuments` (the selected task's project's document library) is
 * offered by the documents editor as "link an existing document" options.
 */
export const myTasksTableConfig = ({ projectDocuments = [] } = {}) => [
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
    getValue: (task) => task.project_id,
    displayValue: (task) => task.project?.name,
    editable: false,
    show: false, // hidden from the edit form -- reassigning project isn't a thing; shown in table via render
    render: (_displayValue, task) => (
      <Link
        to={`/app/workspace/projects/${task.project_id}`}
        onClick={(e) => e.stopPropagation()}
      >
        {task.project?.name}
      </Link>
    ),
  },
  {
    key: "title",
    label: "Task",
    getValue: "title",
    editable: true,
    editor: "text",
    required: true,
  },
  {
    key: "status",
    label: "Status",
    getValue: "status",
    displayValue: (task) =>
      TASK_STATUSES.find((s) => s.value === task.status)?.label,
    // Status only ever changes via TaskCard's quick-action buttons -- read-
    // only here (disabled select, resolves to its label). My Tasks has no
    // Add Task flow (every row is, by definition, one the viewer is
    // already assigned to), so unlike taskTableConfig.jsx there's no
    // `creating` case to hide this for -- always shown. NOT computed:true
    // -- handleSave (MyTasks.jsx) strips `status` back out of the
    // submitted fields before calling updateTask, the same defensive
    // destructure already used there for `documents`.
    editable: false,
    editor: "select",
    options: TASK_STATUSES,
    isSearchable: false,
    isClearable: false,
    half: true,
  },
  {
    key: "due_date",
    label: "Due Date",
    getValue: "due_date",
    editable: true,
    editor: "date",
    half: true,
    required: true,
  },
  {
    key: "start_date",
    label: "Start Date",
    getValue: "start_date",
    editable: true,
    editor: "date",
    section: "Lifecycle Dates",
    half: true,
  },
  {
    key: "completed_date",
    label: "Completed Date",
    getValue: "completed_date",
    editable: true,
    editor: "date",
    section: "Lifecycle Dates",
    half: true,
  },
  {
    key: "description",
    label: "Description",
    getValue: "description",
    editable: true,
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
    editable: true,
    editor: "taskDocuments",
    options: projectDocuments,
    section: "Documents",
  },
];
