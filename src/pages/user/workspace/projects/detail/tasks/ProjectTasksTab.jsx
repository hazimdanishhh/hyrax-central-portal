import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { PlusIcon, PencilSimpleLineIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../components/crud/noResult/NoResult";
import DataSidebar from "../../../../../../components/dataSidebar/DataSidebar";
import Button from "../../../../../../components/buttons/button/Button";
import PageHeader from "../../../../../../components/crud/pageHeader/PageHeader";
import ActionModal from "../../../../../../components/modals/actionModal/ActionModal";
import TaskCard from "../../../../../../components/workspace/taskCard/TaskCard";
import SearchFilterBar from "../../../../../../components/searchFilterBar/SearchFilterBar";
import ActiveFiltersBar from "../../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import StatusTab from "../../../../../../components/crud/statusTab/StatusTab";
import { buildStatusTabs } from "../../../../../../functions/statusTabs";
import { useEmployee } from "../../../../../../context/EmployeeContext";
import { useProject } from "../../../../../../features/workspace/projects/private/hooks/useProject";
import { useProjectPermissions } from "../../../../../../features/workspace/projects/private/hooks/useProjectPermissions";
import { useTasksByProject } from "../../../../../../features/workspace/tasks/private/hooks/useTasksByProject";
import { useProjectDocuments } from "../../../../../../features/workspace/tasks/private/hooks/useProjectDocuments";
import useTaskMutations from "../../../../../../features/workspace/tasks/private/hooks/useTaskMutations";
import useTaskAssigneeMutations from "../../../../../../features/workspace/tasks/private/hooks/useTaskAssigneeMutations";
import useTaskDocumentMutations from "../../../../../../features/workspace/tasks/private/hooks/useTaskDocumentMutations";
import { useTaskStatusAction } from "../../../../../../features/workspace/tasks/private/hooks/useTaskStatusAction";
import { isTaskAssignee } from "../../../../../../features/workspace/tasks/private/taskPermissions";
import {
  TASK_STATUSES,
  TASK_STATUS_TYPE,
} from "../../../../../../features/workspace/tasks/private/taskStatusMeta";
import { taskTableConfig } from "./tableConfig";
import { getProjectTasksFilterConfig } from "./filterConfig";

/**
 * Full, unlimited card list of one project's tasks (mirrors BillSidebar's
 * "show everything" precedent -- this IS the primary place to see a
 * project's tasks, per req #6: every member, including cc, can see ALL
 * tasks). "Add Task" and task edit both open as sidebars (matching "Add
 * Project" elsewhere in this module), not the earlier inline-form
 * approach. Row click opens a full edit sidebar with columns recomputed
 * per-selection so only the task's own assignees can actually save
 * changes (req #6); TaskCard's own quick status-transition buttons are
 * gated the same way.
 *
 * Search/status-tabs/Assignee-filter are CLIENT-SIDE over the already
 * unpaginated `tasks` array (tasksByProjectService.js's own header comment:
 * "deliberately unpaginated... revisit if a project could plausibly reach
 * hundreds of tasks") -- deliberately not usePaginatedQuery, which is a
 * pagination hook first. `search`/`status`/`assignee` are still read
 * straight from the URL via useSearchParams so the filtered view stays
 * shareable/bookmarkable, matching every other list page's spirit without
 * adopting its page-splitting machinery.
 */
export default function ProjectTasksTab() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { employee } = useEmployee();
  const { members } = useProject(projectId);
  const permissions = useProjectPermissions(members);
  const { tasks, isLoading, error } = useTasksByProject(projectId);
  const { documents: projectDocuments } = useProjectDocuments(projectId);
  const { createTask, updateTask, deleteTask, creating, updating, deleting } =
    useTaskMutations(projectId);
  const { syncAssignees } = useTaskAssigneeMutations(projectId);
  const { syncDocumentLinks } = useTaskDocumentMutations(projectId);
  const {
    pendingAction,
    modalOpen,
    requestStatusChange,
    cancelAction,
    confirmAction,
  } = useTaskStatusAction(updateTask);

  const [addingOpen, setAddingOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingOpen, setEditingOpen] = useState(false);

  const workingMembers = members.filter(
    (m) => m.role === "owner" || m.role === "lead" || m.role === "member",
  );

  const createColumns = taskTableConfig({
    workingMembers,
    canEdit: true,
    projectDocuments,
  });

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const assignee = searchParams.get("assignee") || "";
  const filters = { assignee };
  const filterConfig = getProjectTasksFilterConfig({ workingMembers });
  const statusTabs = buildStatusTabs({
    searchParams,
    statuses: TASK_STATUSES,
    statusTypeMap: TASK_STATUS_TYPE,
  });

  function updateParams(patch) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        Object.entries(patch).forEach(([key, value]) => {
          if (value === undefined || value === null || value === "") {
            params.delete(key);
          } else {
            params.set(key, String(value));
          }
        });
        return params;
      },
      { replace: true },
    );
  }

  const setSearch = (val) => updateParams({ search: val });
  const setFilters = (newFilters) => updateParams(newFilters);
  const resetParams = () => setSearchParams({});

  const activeFilters = Object.entries(filters).filter(
    ([, v]) => v !== "" && v != null,
  );
  const hasActiveFilters = activeFilters.length > 0 || search.length > 0;

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (status && t.status !== status) return false;
      if (
        assignee &&
        !(t.task_assignees ?? []).some((a) => a.employee_id === assignee)
      )
        return false;
      if (
        q &&
        !`${t.title ?? ""} ${t.description ?? ""}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [tasks, status, assignee, search]);

  function handleRowClick(task) {
    setSelectedTask(task);
    setEditingOpen(true);
  }

  function handleCloseEdit() {
    setEditingOpen(false);
    setSelectedTask(null);
  }

  async function handleAddTask(formData) {
    const { assignee_ids: assigneeIds, documents, ...taskFields } = formData;

    const newTask = await createTask({
      ...taskFields,
      project_id: projectId,
      created_by: employee?.id,
    });

    if (assigneeIds?.length) {
      await syncAssignees({ taskId: newTask.id, employeeIds: assigneeIds });
    }

    if (documents?.length) {
      await syncDocumentLinks({ taskId: newTask.id, projectId, documents });
    }

    setAddingOpen(false);
  }

  // A working member who isn't this task's own assignee still passes
  // canAttachDocuments (see tableConfig.jsx), so updateTask/syncAssignees --
  // gated by the assignee-only "Assignees can update their tasks" RLS
  // policy -- must be skipped for them; only the document sync (gated by
  // the looser "working member" task_documents policy) should run.
  async function handleEditSave(formData) {
    const { assignee_ids: assigneeIds, documents, ...taskFields } = formData;

    if (canEditSelectedTask) {
      await updateTask({ id: selectedTask.id, ...taskFields });
      await syncAssignees({
        taskId: selectedTask.id,
        employeeIds: assigneeIds || [],
      });
    }

    if (permissions.isWorkingMember) {
      await syncDocumentLinks({
        taskId: selectedTask.id,
        projectId,
        documents: documents || [],
      });
    }

    handleCloseEdit();
  }

  async function handleDelete() {
    await deleteTask(selectedTask.id);
    handleCloseEdit();
  }

  const canEditSelectedTask = isTaskAssignee(selectedTask, employee?.id);
  const editColumns = selectedTask
    ? taskTableConfig({
        workingMembers,
        canEdit: canEditSelectedTask,
        canAttachDocuments: permissions.isWorkingMember,
        projectDocuments,
      })
    : [];

  const hasData = filteredTasks.length > 0;

  const pendingLabel = pendingAction?.label;
  const pendingStatusName =
    TASK_STATUSES.find((s) => s.value === pendingAction?.nextStatus)?.label ||
    "Updated";

  return (
    <>
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search tasks..."
      />

      {hasActiveFilters && (
        <ActiveFiltersBar
          search={search}
          setSearch={setSearch}
          filters={activeFilters}
          setFilters={setFilters}
          filterConfig={filterConfig}
          resetParams={resetParams}
        />
      )}

      {permissions.isWorkingMember && (
        <PageHeader>
          <Button
            name="Add Task"
            icon={PlusIcon}
            style="button buttonType5 approval textXS"
            size={16}
            onClick={() => setAddingOpen(true)}
          />
        </PageHeader>
      )}

      <div className="statusTabsRow scrollbar">
        {statusTabs.map((tab) => (
          <StatusTab
            key={tab.label}
            to={tab.to}
            label={tab.label}
            themeType={tab.themeType}
            isActive={tab.isActive}
          />
        ))}
      </div>

      <CardLayout style="cardWrapperScroll">
        {isLoading ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData || error ? (
          <NoResult
            title={
              error
                ? "Error loading tasks"
                : tasks.length === 0
                  ? "No tasks yet"
                  : "No tasks match your search/filters"
            }
          />
        ) : (
          <CardLayout style="cardLayout1 cardGapSmall">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canEdit={isTaskAssignee(task, employee?.id)}
                onClick={() => handleRowClick(task)}
                onRequestStatusChange={requestStatusChange}
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>

      <AnimatePresence>
        {addingOpen && (
          <DataSidebar
            title="Add Task"
            icon={PlusIcon}
            open={addingOpen}
            onClose={() => setAddingOpen(false)}
            rowData={{}}
            columns={createColumns}
            onSave={handleAddTask}
            onCancel={() => setAddingOpen(false)}
            saving={creating}
            creating
            hideDelete
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingOpen && selectedTask && (
          <DataSidebar
            title={canEditSelectedTask ? "Edit Task" : "Task Details"}
            icon={PencilSimpleLineIcon}
            open={editingOpen}
            onClose={handleCloseEdit}
            rowData={selectedTask}
            columns={editColumns}
            onSave={handleEditSave}
            onDelete={handleDelete}
            onCancel={handleCloseEdit}
            saving={updating}
            deleting={deleting}
            cannotUpdate={!canEditSelectedTask && !permissions.isWorkingMember}
            hideDelete={!permissions.isElevated}
          />
        )}
      </AnimatePresence>

      <ActionModal
        open={modalOpen}
        onClose={cancelAction}
        title={`${pendingLabel || "Update"} Task`}
        description={`Are you sure you want to mark "${pendingAction?.task?.title}" as ${pendingStatusName}?`}
        confirmText={pendingLabel || "Confirm"}
        loading={updating}
        onConfirm={confirmAction}
        modalType={pendingLabel === "Cancel" ? "delete" : "approve"}
      />
    </>
  );
}
