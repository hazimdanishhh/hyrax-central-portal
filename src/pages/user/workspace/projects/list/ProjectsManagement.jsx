// pages/user/workspace/projects/list/ProjectsManagement.jsx
import {
  PencilSimpleLineIcon,
  PlusCircleIcon,
  FolderIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import DataTable from "../../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import { AnimatePresence } from "framer-motion";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../../components/crud/pageHeader/PageHeader";
import PageActions from "../../../../../components/crud/pageActions/PageActions";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import SortBar from "../../../../../components/crud/sortBar/SortBar";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { useEmployee } from "../../../../../context/EmployeeContext";
import useAllEmployeesPublic from "../../../../../features/hr/employees/public/hooks/useAllEmployeesPublic";
import { useProjectCategories } from "../../../../../features/workspace/projects/private/hooks/useProjectCategories";
import useProjectMutations from "../../../../../features/workspace/projects/private/hooks/useProjectMutations";
import { fetchProjects } from "../../../../../features/workspace/projects/private/api/projectsService";
import { useProjectsOverview } from "../../../../../features/workspace/projects/private/hooks/useProjectsOverview";
import { projectsTableConfig } from "./tableConfig";
import { getProjectsFilterConfig } from "./filterConfig";
import { getProjectsSortConfig } from "./sortConfig";
import { getProjectsOverviewConfig } from "./overviewConfig";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import PageTitle from "../../../../../components/pageTitle/PageTitle";
import ProjectCard from "../../../../../components/workspace/projectCard/ProjectCard";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import StatusTab from "../../../../../components/crud/statusTab/StatusTab";
import { buildStatusTabs } from "../../../../../functions/statusTabs";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_TYPE,
} from "../../../../../features/workspace/projects/private/projectStatusMeta";
import { useTheme } from "../../../../../context/ThemeContext";

/**
 * Projects list -- "Add Project" is the only sidebar use on this page; row
 * click navigates to the full standalone detail page
 * (/app/workspace/projects/:id), not a sidebar, since a project's task
 * list needs real table real estate (see plan's routing rationale).
 * Editing/deleting an existing project lives on that detail page instead
 * (edit: any elevated member; delete: owner-only), not here.
 */
export default function ProjectsManagement() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { employee } = useEmployee();
  const [creatingOpen, setCreatingOpen] = useState(false);

  const {
    data: projects,
    totalCount,
    page,
    totalPages,
    search,
    filters,
    sortBy,
    sortOrder,
    activeFilters,
    hasActiveFilters,
    setPage,
    setSearch,
    setFilters,
    setSortBy,
    setSortOrder,
    resetParams,
    isLoading: projectsLoading,
    isFetching: projectsFetching,
    error: projectsError,
  } = usePaginatedQuery({
    queryKey: "projects",
    queryFn: fetchProjects,
    pageSize: 20,
    defaultSortBy: "name",
  });

  const { categories, isLoading: categoriesLoading } = useProjectCategories();
  const { data: allEmployees = [], isLoading: employeesLoading } =
    useAllEmployeesPublic();
  const { createProject, creating } = useProjectMutations();

  const {
    kpis,
    isLoading: overviewLoading,
    error: overviewError,
  } = useProjectsOverview();
  const overviewItems = getProjectsOverviewConfig(kpis);

  const isLoading = projectsLoading || categoriesLoading || employeesLoading;
  const error = projectsError;
  const isFetching = projectsFetching;
  const hasData = projects.length > 0;

  const createColumns = projectsTableConfig({
    categories,
    allEmployees,
    creating: true,
  });
  const filterConfig = getProjectsFilterConfig({ categories });
  const sortOptions = getProjectsSortConfig();
  const statusTabs = buildStatusTabs({
    searchParams,
    statuses: PROJECT_STATUSES,
    statusTypeMap: PROJECT_STATUS_TYPE,
  });

  function handleOpenCreate() {
    setCreatingOpen(true);
  }

  function handleCloseCreate() {
    setCreatingOpen(false);
  }

  function handleRowClick(project) {
    navigate(`/app/workspace/projects/${project.id}`);
  }

  async function handleCreateSave(formData) {
    // Always includes the creator themselves regardless of what's picked
    // in the "Members" field -- belt-and-suspenders on top of
    // create_project()'s own server-side guarantee
    // (auto_add_project_creator_as_member trigger), so this can't be
    // silently broken by unchecking yourself.
    const memberIds = new Set(formData.member_employee_ids || []);
    if (employee?.id) memberIds.add(employee.id);

    const newProjectId = await createProject({
      name: formData.name,
      description: formData.description,
      startDate: formData.start_date,
      targetEndDate: formData.target_end_date,
      categoryId: formData.category_id,
      leadEmployeeIds: formData.lead_employee_ids || [],
      memberEmployeeIds: [...memberIds],
      ccEmployeeIds: formData.cc_employee_ids || [],
    });

    setCreatingOpen(false);
    navigate(`/app/workspace/projects/${newProjectId}`);
  }

  if (!employee && !isLoading) {
    return (
      <NoResult title="Your account isn't linked to an employee record yet -- contact a superadmin before creating or joining a project." />
    );
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={FolderIcon} current="Projects" />

          <CardWrapper>
            <PageTitle
              title="Projects"
              subtitle="Manage your projects and details."
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
              placeholder="Search projects..."
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

            <PageHeader>
              <PageActions
                actionButtons={[
                  {
                    name: "Add Project",
                    icon: PlusCircleIcon,
                    onClick: handleOpenCreate,
                    style: "button buttonType5 approval textXXS",
                  },
                ]}
              />

              <SortBar
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOptions={sortOptions}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
              />
            </PageHeader>

            <PageResult
              data={projects}
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

            <CardLayout style="cardWrapperScroll">
              {isLoading || isFetching ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : !hasData || error ? (
                <NoResult />
              ) : (
                // CARD LAYOUT
                <CardLayout style="cardLayout2 cardGapSmall">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      category={categories.find(
                        (c) => c.id === project.category_id,
                      )}
                      onClick={() => handleRowClick(project)}
                    />
                  ))}
                </CardLayout>
              )}
            </CardLayout>

            <AnimatePresence>
              {creatingOpen && (
                <DataSidebar
                  title="Add Project"
                  icon={PencilSimpleLineIcon}
                  open={creatingOpen}
                  onClose={handleCloseCreate}
                  rowData={{}}
                  columns={createColumns}
                  onSave={handleCreateSave}
                  onCancel={handleCloseCreate}
                  saving={creating}
                  creating
                  hideDelete
                />
              )}
            </AnimatePresence>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
