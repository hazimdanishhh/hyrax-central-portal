// pages/user/workspace/projects/list/tableConfig.jsx
import StatusBox from "../../../../../components/status/statusBox/StatusBox";
import ProgressBar from "../../../../../components/progressBar/ProgressBar";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_TYPE,
} from "../../../../../features/workspace/projects/private/projectStatusMeta";

/**
 * Factory function, re-invoked fresh per render (same convention as
 * itAssetTableConfig etc). `creating` toggles the three initial-role
 * picker fields (lead/member/cc employee ids) on ONLY for the "Add
 * Project" form -- editing an existing project's membership happens on
 * the Members tab instead, via syncProjectMembers, not through this form.
 *
 * category_id is resolved to a display name client-side against the
 * already-loaded `categories` list (not a PostgREST embed -- see
 * projectsService.js's comment on why embedding through a view doesn't
 * work here).
 */
export const projectsTableConfig = ({
  categories = [],
  allEmployees = [],
  creating = false,
}) => {
  const employeeOptions = allEmployees.map((e) => ({
    label: e.full_name,
    value: e.id,
  }));

  const columns = [
    {
      key: "id",
      label: "ID",
      getValue: "id",
      editable: false,
      editor: "text",
      show: false,
    },
    {
      key: "name",
      label: "Project Name",
      getValue: "name",
      editable: true,
      editor: "text",
      required: true,
    },
    {
      key: "status",
      label: "Status",
      getValue: "status",
      displayValue: (project) =>
        PROJECT_STATUSES.find((s) => s.value === project.status)?.label,
      editable: true,
      editor: "select",
      options: PROJECT_STATUSES,
      isSearchable: false,
      // create_project() always defaults a new project to PLANNING (no
      // status param) -- hidden from the create form so a pick here can
      // never silently be ignored; still editable once the project exists.
      show: !creating,
      render: (_displayValue, project) => (
        <StatusBox
          status={
            PROJECT_STATUSES.find((s) => s.value === project.status)?.label ||
            project.status
          }
          type={PROJECT_STATUS_TYPE[project.status] || "grey"}
        />
      ),
    },
    {
      key: "category_id",
      label: "Category",
      getValue: (project) => project.category_id,
      displayValue: (project) =>
        categories.find((c) => c.id === project.category_id)?.name || "—",
      editable: true,
      editor: "projectCategorySelect",
    },
    {
      key: "progress_percentage",
      label: "Progress",
      getValue: (project) => project.progress_percentage,
      editable: false,
      show: false, // hides from the create/edit form (see DataForm.jsx's col.show check) -- purely computed, still shown in the table via `render`
      computed: true, // server-computed (projects_with_progress view) -- projects has NO such column; DataForm must never seed/submit this (see PGRST204 bug)
      render: (_displayValue, project) => (
        <ProgressBar
          value={project.progress_percentage}
          label={`${project.name} progress`}
        />
      ),
    },
    {
      key: "start_date",
      label: "Start Date",
      getValue: "start_date",
      editable: true,
      editor: "date",
      section: "Dates",
      half: true,
    },
    {
      key: "target_end_date",
      label: "Target End Date",
      getValue: "target_end_date",
      editable: true,
      editor: "date",
      section: "Dates",
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
  ];

  if (creating) {
    columns.push(
      {
        key: "lead_employee_ids",
        label: "Project Leads",
        getValue: () => [],
        editable: true,
        editor: "multiSelect",
        options: employeeOptions,
        section: "Initial Team (optional)",
      },
      {
        key: "member_employee_ids",
        label: "Members",
        getValue: () => [],
        editable: true,
        editor: "multiSelect",
        options: employeeOptions,
        section: "Initial Team (optional)",
      },
      {
        key: "cc_employee_ids",
        label: "Supervisors (CC)",
        getValue: () => [],
        editable: true,
        editor: "multiSelect",
        options: employeeOptions,
        section: "Initial Team (optional)",
      },
    );
  }

  return columns;
};
