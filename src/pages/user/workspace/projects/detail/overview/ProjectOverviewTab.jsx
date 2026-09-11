import { useParams } from "react-router";
import { GaugeIcon, ChartPieSliceIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../components/crud/noResult/NoResult";
import SectionHeader from "../../../../../../components/sectionHeader/SectionHeader";
import OverviewCards from "../../../../../../components/crud/overviewCards/OverviewCards";
import ChartCard from "../../../../../../components/chartCard/ChartCard";
import PieChartRenderer from "../../../../../../components/chartCard/PieChartRenderer";
import HorizontalMultiBarRenderer from "../../../../../../components/chartCard/HorizontalMultiBarRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  RED_COLOR,
  YELLOW_COLOR,
  TASK_STATUS_COLORS,
} from "../../../../../../components/chartCard/chartColors";
import { useProject } from "../../../../../../features/workspace/projects/private/hooks/useProject";
import { useProjectOverview } from "../../../../../../features/workspace/projects/private/hooks/useProjectOverview";
import { getProjectOverviewConfig } from "./overviewConfig";

/**
 * Read-only per-project dashboard -- a 2-section storyline (Project
 * Snapshot KPIs, then a Task & Team Insights chart pair shown side by
 * side in one cardLayout2 grid -- its actual intended purpose, laying
 * multiple ChartCards out together, rather than one lonely chart per
 * grid), backed by one get_project_overview RPC round trip. Mirrors
 * ProjectMembersTab.jsx/ProjectDocumentsTab.jsx's shell for the
 * loading/error states, but has no sidebar/mutation machinery of its own
 * -- nothing here is editable.
 */
export default function ProjectOverviewTab() {
  const { projectId } = useParams();
  const { isLoading: projectLoading, error: projectError } =
    useProject(projectId);
  const {
    kpis,
    taskStatusData,
    memberPerformanceData,
    isLoading: overviewLoading,
    error: overviewError,
  } = useProjectOverview(projectId);

  const isLoading = projectLoading || overviewLoading;
  const error = projectError || overviewError;

  if (isLoading) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <LoadingIcon />
      </CardLayout>
    );
  }

  if (error) {
    return <NoResult title="Error loading project overview" />;
  }

  const overviewItems = getProjectOverviewConfig(kpis, projectId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
      <div>
        <SectionHeader icon={GaugeIcon} title="Project Snapshot" />
        <OverviewCards items={overviewItems} />
      </div>

      <div>
        <SectionHeader icon={ChartPieSliceIcon} title="Task & Team Insights" />
        <CardLayout style="cardLayout2">
          <ChartCard
            title="Tasks by Status"
            subtitle="Current status composition for this project's tasks"
            style="cardGapSmall"
          >
            {taskStatusData.length > 0 ? (
              <PieChartRenderer
                data={taskStatusData}
                mode="semantic"
                colorMap={TASK_STATUS_COLORS}
                centerLabel="total"
                centerSubLabel="Tasks"
              />
            ) : (
              <NoResult title="No tasks yet" />
            )}
          </ChartCard>

          <ChartCard
            title="Tasks by Assignee"
            subtitle="Assigned, completed, overdue, and late-completed task counts per team member"
            style="cardGapSmall"
          >
            {memberPerformanceData.length > 0 ? (
              <HorizontalMultiBarRenderer
                data={memberPerformanceData}
                bars={[
                  {
                    dataKey: "assigned_count",
                    name: "Assigned",
                    color: BLUE_COLOR,
                  },
                  {
                    dataKey: "completed_count",
                    name: "Completed",
                    color: GREEN_COLOR,
                  },
                  {
                    dataKey: "overdue_count",
                    name: "Overdue",
                    color: RED_COLOR,
                  },
                  {
                    dataKey: "completed_late_count",
                    name: "Completed Late",
                    color: YELLOW_COLOR,
                  },
                ]}
              />
            ) : (
              <NoResult title="No tasks assigned yet" />
            )}
          </ChartCard>
        </CardLayout>
      </div>
    </div>
  );
}
