import { useState } from "react";
import { useParams, useNavigate, NavLink, Outlet } from "react-router";
import {
  FolderIcon,
  ListChecksIcon,
  UsersIcon,
  FileIcon,
  PencilSimpleLineIcon,
  ArrowsLeftRightIcon,
  TrashIcon,
  ClockIcon,
  WarningCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
import { useTheme } from "../../../../../context/ThemeContext";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import Button from "../../../../../components/buttons/button/Button";
import StatusBox from "../../../../../components/status/statusBox/StatusBox";
import ProgressBar from "../../../../../components/progressBar/ProgressBar";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import Select from "react-select";
import { useProject } from "../../../../../features/workspace/projects/private/hooks/useProject";
import { useProjectPermissions } from "../../../../../features/workspace/projects/private/hooks/useProjectPermissions";
import useProjectMutations from "../../../../../features/workspace/projects/private/hooks/useProjectMutations";
import { useProjectCategories } from "../../../../../features/workspace/projects/private/hooks/useProjectCategories";
import useAllEmployeesPublic from "../../../../../features/hr/employees/public/hooks/useAllEmployeesPublic";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_TYPE,
} from "../../../../../features/workspace/projects/private/projectStatusMeta";
import { projectsTableConfig } from "../list/tableConfig";
import "./ProjectDetailLayout.scss";
import IconCard from "../../../../../components/iconCard/IconCard";
import { getDueDateStatus } from "../../../../../functions/dueDateStatus";
import { formatDate } from "../../../../../functions/formatDate";
import StatusBadge from "../../../../../components/status/statusBadge/StatusBadge";

/**
 * A "smart" per-record tab shell -- unlike the existing static
 * *PageLayout.jsx files (tabs + bare <Outlet/>, no data fetching of their
 * own), this one calls useProject(projectId) itself for the header, since
 * the URL only carries :projectId. Tabs (Tasks, Members -- Overview cut
 * per the product owner's decision) each independently re-call useProject
 * rather than reading Outlet context (unused anywhere in this codebase);
 * React Query dedupes the shared ["project", projectId] key for free.
 */
export default function ProjectDetailLayout() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { project, members, isLoading, error } = useProject(projectId);
  const permissions = useProjectPermissions(members);
  const { categories } = useProjectCategories();
  const { data: allEmployees = [] } = useAllEmployeesPublic();
  const {
    updateProject,
    deleteProject,
    transferProjectOwnership,
    updating,
    deleting,
    transferringOwnership,
  } = useProjectMutations();

  const [editingOpen, setEditingOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);

  if (isLoading) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <LoadingIcon />
      </CardLayout>
    );
  }

  // A null result with no error is the CORRECT behavior for "you aren't a
  // member of this project" once RLS is enforced -- a non-member's request
  // simply returns zero rows, no special-cased "unauthorized" branch needed.
  if (!project || error) {
    return <NoResult title="Project not found" />;
  }

  const editColumns = projectsTableConfig({
    categories,
    allEmployees,
    creating: false,
  });

  async function handleEditSave(formData) {
    await updateProject({ id: project.id, ...formData });
    setEditingOpen(false);
  }

  async function handleConfirmDelete() {
    try {
      await deleteProject(project.id);
      setDeleteModalOpen(false);
      navigate("/app/workspace/projects");
    } catch (err) {
      console.error(err);
    }
  }

  async function handleConfirmTransfer() {
    if (!transferTargetId) return;
    await transferProjectOwnership({
      projectId: project.id,
      newOwnerEmployeeId: transferTargetId,
    });
    handleCloseTransfer();
  }

  async function handleConfirmComplete() {
    await updateProject({ id: project.id, status: "COMPLETED" });
    setCompleteModalOpen(false);
  }

  function handleCloseTransfer() {
    setTransferOpen(false);
    setTransferTargetId(null);
  }

  const otherMemberOptions = members
    .filter((m) => m.role !== "owner" && m.role !== "cc")
    .map((m) => ({ label: m.employee?.full_name, value: m.employee_id }));

  // Req #9's own design deliberately keeps COMPLETED manual -- a project
  // can be fully task-complete and still waiting on sign-off -- so this is
  // a nudge, not an auto-transition. active_task_count/completed_task_count
  // already come from the projects_with_progress view, no extra query.
  const allTasksComplete =
    project.active_task_count > 0 &&
    project.completed_task_count === project.active_task_count &&
    project.status !== "COMPLETED";

  const endDateStatus = getDueDateStatus(
    project.target_end_date,
    project.status,
  );

  return (
    <>
      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs
              icon={FolderIcon}
              current={project.name}
              to1="/app/workspace/projects"
              name1="Projects"
              icon1={FolderIcon}
            />

            <CardWrapper>
              <div className="projectDetailHeader generalCard">
                <div className="projectDetailHeaderTop">
                  <div className="projectDetailHeaderTitle">
                    <p className="textBold textM">{project.name}</p>
                    <StatusBadge
                      status={
                        PROJECT_STATUSES.find((s) => s.value === project.status)
                          ?.label || project.status
                      }
                      type={PROJECT_STATUS_TYPE[project.status] || "grey"}
                    />
                    {project.category_id && (
                      <StatusBox
                        status={
                          categories.find((c) => c.id === project.category_id)
                            ?.name
                        }
                        type="blue"
                      />
                    )}
                  </div>

                  {project.description && (
                    <p className="textLight textXXS projectCardDescription">
                      {project.description}
                    </p>
                  )}

                  <div className="projectDetailHeaderDates">
                    <IconCard
                      icon={ClockIcon}
                      weight="fill"
                      name={`Start: ${formatDate(project.start_date)}`}
                      style="blue textXXS"
                    />
                    <IconCard
                      icon={
                        endDateStatus.isOverdue ? WarningCircleIcon : ClockIcon
                      }
                      weight="fill"
                      name={`End: ${formatDate(project.target_end_date)}`}
                      style={`${endDateStatus.colorClass} textXXS`}
                    />
                  </div>

                  <div className="projectDetailHeaderActions">
                    {permissions.isElevated && (
                      <Button
                        name="Edit Project"
                        icon={PencilSimpleLineIcon}
                        style="button buttonType5 textXS"
                        size={16}
                        onClick={() => setEditingOpen(true)}
                      />
                    )}
                    {permissions.isOwner && (
                      <Button
                        name="Transfer Ownership"
                        icon={ArrowsLeftRightIcon}
                        style="button buttonType5 textXS"
                        size={16}
                        onClick={() => setTransferOpen(true)}
                      />
                    )}
                    {permissions.isOwner && (
                      <Button
                        name="Delete"
                        icon={TrashIcon}
                        style="button buttonType5 rejection textXS"
                        size={16}
                        onClick={() => setDeleteModalOpen(true)}
                      />
                    )}
                  </div>
                </div>

                {allTasksComplete && permissions.isElevated && (
                  <div className="projectDetailCompleteNudge">
                    <p className="textRegular textXS">
                      All tasks are complete.
                    </p>
                    <Button
                      name="Mark as Completed"
                      icon={CheckCircleIcon}
                      style="button buttonType5 approval textXS"
                      size={16}
                      onClick={() => setCompleteModalOpen(true)}
                    />
                  </div>
                )}

                <ProgressBar
                  value={project.progress_percentage}
                  label={`${project.name} progress`}
                />
              </div>

              <div className="pageTabContainer">
                <NavLink
                  to={`/app/workspace/projects/${projectId}/tasks`}
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${isActive ? "active" : ""}`
                  }
                >
                  <div className="pageTabIcon">
                    <ListChecksIcon size={15} />
                  </div>
                  Tasks
                </NavLink>

                <NavLink
                  to={`/app/workspace/projects/${projectId}/members`}
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${isActive ? "active" : ""}`
                  }
                >
                  <div className="pageTabIcon">
                    <UsersIcon size={15} />
                  </div>
                  Members
                </NavLink>

                <NavLink
                  to={`/app/workspace/projects/${projectId}/documents`}
                  className={({ isActive }) =>
                    `button buttonTypeTab textRegular textXS ${isActive ? "active" : ""}`
                  }
                >
                  <div className="pageTabIcon">
                    <FileIcon size={15} />
                  </div>
                  Documents
                </NavLink>
              </div>

              <Outlet />
            </CardWrapper>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {editingOpen && (
          <DataSidebar
            title="Edit Project"
            icon={PencilSimpleLineIcon}
            open={editingOpen}
            onClose={() => setEditingOpen(false)}
            rowData={project}
            columns={editColumns}
            onSave={handleEditSave}
            onCancel={() => setEditingOpen(false)}
            saving={updating}
            hideDelete
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {transferOpen && (
          <DataSidebar
            title="Transfer Ownership"
            icon={ArrowsLeftRightIcon}
            open={transferOpen}
            onClose={handleCloseTransfer}
            isEditing={false}
            hideDelete
          >
            <div className="projectDetailTransferPanel">
              <p className="textRegular textXS">Transfer ownership to:</p>
              <Select
                unstyled
                className="selectContainer"
                classNamePrefix="reactSelect"
                placeholder="Select a member..."
                options={otherMemberOptions}
                value={
                  otherMemberOptions.find(
                    (o) => o.value === transferTargetId,
                  ) || null
                }
                onChange={(opt) => setTransferTargetId(opt?.value ?? null)}
              />
              <Button
                name="Confirm Transfer"
                icon={ArrowsLeftRightIcon}
                style="button buttonType5 approval textXS"
                size={16}
                disabled={!transferTargetId || transferringOwnership}
                onClick={handleConfirmTransfer}
              />
            </div>
          </DataSidebar>
        )}
      </AnimatePresence>

      <ActionModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Project"
        description="Are you sure you want to delete this project? It must be CANCELLED with no remaining tasks first."
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        modalType="delete"
      />

      <ActionModal
        open={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Mark Project as Completed"
        description="Are you sure you want to mark this project as Completed?"
        confirmText="Mark as Completed"
        loading={updating}
        onConfirm={handleConfirmComplete}
        modalType="approve"
      />
    </>
  );
}
