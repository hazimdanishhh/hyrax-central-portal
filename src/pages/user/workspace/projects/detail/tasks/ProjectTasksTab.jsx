import { useState } from "react";
import { useParams } from "react-router";
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
import { useEmployee } from "../../../../../../context/EmployeeContext";
import { useProject } from "../../../../../../features/workspace/projects/private/hooks/useProject";
import { useProjectPermissions } from "../../../../../../features/workspace/projects/private/hooks/useProjectPermissions";
import { useTasksByProject } from "../../../../../../features/workspace/tasks/private/hooks/useTasksByProject";
import useTaskMutations from "../../../../../../features/workspace/tasks/private/hooks/useTaskMutations";
import useTaskAssigneeMutations from "../../../../../../features/workspace/tasks/private/hooks/useTaskAssigneeMutations";
import { useTaskStatusAction } from "../../../../../../features/workspace/tasks/private/hooks/useTaskStatusAction";
import { isTaskAssignee } from "../../../../../../features/workspace/tasks/private/taskPermissions";
import { taskTableConfig } from "./tableConfig";

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
 */
export default function ProjectTasksTab() {
  const { projectId } = useParams();
  const { employee } = useEmployee();
  const { members } = useProject(projectId);
  const permissions = useProjectPermissions(members);
  const { tasks, isLoading, error } = useTasksByProject(projectId);
  const { createTask, updateTask, deleteTask, creating, updating, deleting } =
    useTaskMutations(projectId);
  const { syncAssignees } = useTaskAssigneeMutations(projectId);
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

  const createColumns = taskTableConfig({ workingMembers, canEdit: true });

  function handleRowClick(task) {
    setSelectedTask(task);
    setEditingOpen(true);
  }

  function handleCloseEdit() {
    setEditingOpen(false);
    setSelectedTask(null);
  }

  async function handleAddTask(formData) {
    const { assignee_ids: assigneeIds, ...taskFields } = formData;

    const newTask = await createTask({
      ...taskFields,
      project_id: projectId,
      created_by: employee?.id,
    });

    if (assigneeIds?.length) {
      await syncAssignees({ taskId: newTask.id, employeeIds: assigneeIds });
    }

    setAddingOpen(false);
  }

  async function handleEditSave(formData) {
    const { assignee_ids: assigneeIds, ...taskFields } = formData;

    await updateTask({ id: selectedTask.id, ...taskFields });
    await syncAssignees({
      taskId: selectedTask.id,
      employeeIds: assigneeIds || [],
    });

    handleCloseEdit();
  }

  async function handleDelete() {
    await deleteTask(selectedTask.id);
    handleCloseEdit();
  }

  const canEditSelectedTask = isTaskAssignee(selectedTask, employee?.id);
  const editColumns = selectedTask
    ? taskTableConfig({ workingMembers, canEdit: canEditSelectedTask })
    : [];

  const hasData = tasks.length > 0;

  const pendingLabel = pendingAction?.label;
  const pendingStatusName =
    pendingLabel === "Cancel"
      ? "Cancelled"
      : pendingLabel === "Start"
        ? "In Progress"
        : "Completed";

  return (
    <>
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

      <CardLayout style="cardWrapperScroll generalCard cardPaddingSmall">
        {isLoading ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData || error ? (
          <NoResult title={error ? "Error loading tasks" : "No tasks yet"} />
        ) : (
          <CardLayout style="cardLayout1">
            {tasks.map((task) => (
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
            cannotUpdate={!canEditSelectedTask}
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
