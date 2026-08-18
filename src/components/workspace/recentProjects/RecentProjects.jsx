import { useNavigate } from "react-router";
import { FolderIcon } from "@phosphor-icons/react";
import ChartCard from "../../chartCard/ChartCard";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import NoResult from "../../crud/noResult/NoResult";
import ProjectCard from "../projectCard/ProjectCard";
import { useRecentProjects } from "../../../features/workspace/projects/private/hooks/useRecentProjects";
import { useProjectCategories } from "../../../features/workspace/projects/private/hooks/useProjectCategories";

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
    <ChartCard icon={FolderIcon} title="Recent Projects" viewAllTo="/app/workspace/projects">
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
    </ChartCard>
  );
}
