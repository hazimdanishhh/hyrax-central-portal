// pages/user/workspace/tasks/list/MyTasks.jsx
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  FolderIcon,
  ListChecksIcon,
  PencilSimpleLineIcon,
} from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import StatusTab from "../../../../../components/crud/statusTab/StatusTab";
import { buildStatusTabs } from "../../../../../functions/statusTabs";
import {
  TASK_STATUSES,
  TASK_STATUS_TYPE,
} from "../../../../../features/workspace/tasks/private/taskStatusMeta";
import ActionModal from "../../../../../components/modals/actionModal/ActionModal";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import PageTitle from "../../../../../components/pageTitle/PageTitle";
import TaskCard from "../../../../../components/workspace/taskCard/TaskCard";
import { useMyTasks } from "../../../../../features/workspace/tasks/private/hooks/useMyTasks";
import { useTaskById } from "../../../../../features/workspace/tasks/private/hooks/useTaskById";
import { useProjectDocuments } from "../../../../../features/workspace/tasks/private/hooks/useProjectDocuments";
import { useAllProjectsLite } from "../../../../../features/workspace/projects/private/hooks/useAllProjectsLite";
import useTaskMutations from "../../../../../features/workspace/tasks/private/hooks/useTaskMutations";
import useTaskDocumentMutations from "../../../../../features/workspace/tasks/private/hooks/useTaskDocumentMutations";
import { useTaskStatusAction } from "../../../../../features/workspace/tasks/private/hooks/useTaskStatusAction";
import { useMyTasksOverview } from "../../../../../features/workspace/tasks/private/hooks/useMyTasksOverview";
import { myTasksTableConfig } from "./tableConfig";
import { getMyTasksFilterConfig } from "./filterConfig";
import { getMyTasksOverviewConfig } from "./overviewConfig";
import { useTheme } from "../../../../../context/ThemeContext";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import SectionHeader from "../../../../../components/sectionHeader/SectionHeader";

/**
 * Cross-project "what do I need to do" view. URL-driven sidebar, mirroring
 * Sales Leads' exact recipe (LeadsManagement.jsx) -- required because
 * notify_task_assigned.sql's link_to points at /app/workspace/tasks/<id>;
 * the sidebar needs a real URL to open for that specific task, including
 * one not on the current page (the useTaskById fallback below), not just
 * local component state.
 */
export default function MyTasks() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();

  const {
    data: tasks,
    totalCount,
    page,
    totalPages,
    search,
    filters,
    activeFilters,
    hasActiveFilters,
    setPage,
    setSearch,
    setFilters,
    resetParams,
    isLoading,
    isFetching,
    error,
  } = useMyTasks();

  const { data: fetchedTask } = useTaskById(taskId);
  const { projects } = useAllProjectsLite();

  // Check the already-loaded paginated page first (instant UI for a normal
  // in-app click), fall back to the dedicated single-fetch result for a
  // direct/shared/notification link where the task isn't on this page.
  const selectedTask = useMemo(() => {
    if (!taskId) return null;
    const taskInList = tasks?.find((t) => t.id === taskId);
    if (taskInList) return taskInList;
    return fetchedTask || null;
  }, [taskId, tasks, fetchedTask]);

  const sidebarOpen = !!selectedTask;

  const { updateTask, updating } = useTaskMutations(selectedTask?.project_id);
  const { syncDocumentLinks } = useTaskDocumentMutations(
    selectedTask?.project_id,
  );
  const { documents: projectDocuments } = useProjectDocuments(
    selectedTask?.project_id,
  );

  console.log("selectedTask", selectedTask);
  const {
    pendingAction,
    modalOpen,
    requestStatusChange,
    cancelAction,
    confirmAction,
  } = useTaskStatusAction(updateTask);

  const {
    kpis,
    isLoading: overviewLoading,
    error: overviewError,
  } = useMyTasksOverview();
  const overviewItems = getMyTasksOverviewConfig(kpis);

  const columns = myTasksTableConfig({ projectDocuments });
  const filterConfig = getMyTasksFilterConfig({ projects });
  const statusTabs = buildStatusTabs({
    searchParams,
    statuses: TASK_STATUSES,
    statusTypeMap: TASK_STATUS_TYPE,
  });

  function handleOpenSidebar(task) {
    navigate(`${task.id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/workspace/tasks?${searchParams.toString()}`);
  }

  async function handleSave(formData) {
    const { documents, ...taskFields } = formData;

    await updateTask({ id: selectedTask.id, ...taskFields });
    await syncDocumentLinks({
      taskId: selectedTask.id,
      projectId: selectedTask.project_id,
      documents: documents || [],
    });

    handleCloseSidebar();
  }

  const hasData = tasks.length > 0;

  const pendingLabel = pendingAction?.label;
  const pendingStatusName =
    TASK_STATUSES.find((s) => s.value === pendingAction?.nextStatus)?.label ||
    "Updated";

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ListChecksIcon} current="My Tasks" />

          <CardWrapper>
            <PageTitle
              title="My Tasks"
              subtitle="View and manage your assigned tasks across all projects."
            />

            {overviewLoading ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : overviewError ? null : (
              <OverviewCards items={overviewItems} />
            )}

            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search my tasks..."
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

            <PageResult
              data={tasks}
              totalCount={totalCount}
              page={page}
              setPage={setPage}
              totalPages={totalPages}
              error={error}
            />

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

            <CardLayout style="cardWrapperScroll generalCard cardPaddingSmall">
              {isLoading || isFetching ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : !hasData || error ? (
                <NoResult title="No tasks assigned to you" />
              ) : (
                <CardLayout style="cardLayout1 cardGapSmall">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canEdit
                      showProject
                      onClick={() => handleOpenSidebar(task)}
                      onRequestStatusChange={requestStatusChange}
                    />
                  ))}
                </CardLayout>
              )}
            </CardLayout>

            <AnimatePresence>
              {sidebarOpen && (
                <DataSidebar
                  title={`${selectedTask?.project.name} Task Details`}
                  icon={ListChecksIcon}
                  open={sidebarOpen}
                  onClose={handleCloseSidebar}
                  rowData={selectedTask}
                  columns={columns}
                  onSave={handleSave}
                  onCancel={handleCloseSidebar}
                  saving={updating}
                  hideDelete
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
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
