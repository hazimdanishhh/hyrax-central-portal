import { useNavigate } from "react-router";
import { ListChecksIcon } from "@phosphor-icons/react";
import ChartCard from "../../chartCard/ChartCard";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import NoResult from "../../crud/noResult/NoResult";
import TaskCard from "../taskCard/TaskCard";
import { useRecentTasks } from "../../../features/workspace/tasks/private/hooks/useRecentTasks";

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
    <ChartCard icon={ListChecksIcon} title="Recent Tasks" viewAllTo="/app/workspace/tasks">
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
    </ChartCard>
  );
}
