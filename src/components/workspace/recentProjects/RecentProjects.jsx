import { useNavigate } from "react-router";
import { CaretRightIcon, FolderIcon } from "@phosphor-icons/react";
import ChartCard from "../../chartCard/ChartCard";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import NoResult from "../../crud/noResult/NoResult";
import ProjectCard from "../projectCard/ProjectCard";
import { useRecentProjects } from "../../../features/workspace/projects/private/hooks/useRecentProjects";
import { useProjectCategories } from "../../../features/workspace/projects/private/hooks/useProjectCategories";
import CardLayout from "../../cardLayout/CardLayout";
import PageHeader from "../../crud/pageHeader/PageHeader";
import SectionHeader from "../../sectionHeader/SectionHeader";
import RouterButton from "../../buttons/routerButton/RouterButton";

/**
 * Home dashboard widget -- newest-created projects the current employee is
 * a member of (RLS-scoped by fetchProjects itself), reusing ProjectCard
 * as-is rather than a bespoke summary row.
 */
export default function RecentProjects() {
  const navigate = useNavigate();
  const { projects, isLoading } = useRecentProjects(5);
  const { categories } = useProjectCategories();

  return (
    <CardLayout style="generalCard recentWorkspaceSection cardPaddingSmall cardGapSmall">
      <PageHeader>
        <SectionHeader icon={FolderIcon} title="Recent Projects" />

        <RouterButton
          name="View All"
          to="/app/workspace/projects"
          style="button buttonType5 textXXXS textBold"
          icon={CaretRightIcon}
        />
      </PageHeader>

      {isLoading ? (
        <LoadingIcon />
      ) : !projects.length ? (
        <NoResult title="No projects yet" />
      ) : (
        projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            category={categories.find((c) => c.id === project.category_id)}
            onClick={() => navigate(`/app/workspace/projects/${project.id}`)}
          />
        ))
      )}
    </CardLayout>
  );
}
