import { useNavigate } from "react-router";
import { CaretRightIcon, ListChecksIcon } from "@phosphor-icons/react";
import ChartCard from "../../chartCard/ChartCard";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import NoResult from "../../crud/noResult/NoResult";
import TaskCard from "../taskCard/TaskCard";
import { useRecentTasks } from "../../../features/workspace/tasks/private/hooks/useRecentTasks";
import RouterButton from "../../buttons/routerButton/RouterButton";
import CardLayout from "../../cardLayout/CardLayout";
import PageHeader from "../../crud/pageHeader/PageHeader";
import SectionHeader from "../../sectionHeader/SectionHeader";
import "./RecentTasks.scss";

/**
 * Home dashboard widget -- newest-created tasks assigned to the current
 * employee, across every project. canEdit=false keeps this a read-only
 * preview (no Start/Complete/Cancel buttons) -- editing happens after
 * clicking through to My Tasks, same as opening a task from a notification.
 */
export default function RecentTasks() {
  const navigate = useNavigate();
  const { tasks, isLoading } = useRecentTasks(5);

  return (
    <CardLayout style="generalCard recentWorkspaceSection cardPaddingSmall cardGapSmall">
      <PageHeader>
        <SectionHeader icon={ListChecksIcon} title="Recent Tasks" />

        <div style={{ display: "flex", gap: "0.2rem" }}>
          <RouterButton
            name="View Overdue"
            to="/app/workspace/tasks?dueStatus=overdue&page=1"
            style="button buttonType5 yellow textXXXS textBold"
            icon={CaretRightIcon}
          />
          <RouterButton
            name="View All"
            to="/app/workspace/tasks"
            style="button buttonType5 textXXXS textBold"
            icon={CaretRightIcon}
          />
        </div>
      </PageHeader>

      {isLoading ? (
        <LoadingIcon />
      ) : !tasks.length ? (
        <NoResult title="No tasks assigned to you" />
      ) : (
        tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            canEdit={false}
            showProject
            onClick={() => navigate(`/app/workspace/tasks/${task.id}`)}
          />
        ))
      )}
    </CardLayout>
  );
}
