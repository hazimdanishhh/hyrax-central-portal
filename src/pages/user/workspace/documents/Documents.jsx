import { useState } from "react";
import { FileIcon } from "@phosphor-icons/react";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import PageTitle from "../../../../components/pageTitle/PageTitle";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import SortBar from "../../../../components/crud/sortBar/SortBar";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import ActionModal from "../../../../components/modals/actionModal/ActionModal";
import DocumentCard from "../../../../components/workspace/documentCard/DocumentCard";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import { useTheme } from "../../../../context/ThemeContext";
import { useEmployee } from "../../../../context/EmployeeContext";
import { useMyDocuments } from "../../../../features/workspace/tasks/private/hooks/useMyDocuments";
import useDocumentMutations from "../../../../features/workspace/tasks/private/hooks/useDocumentMutations";
import { useAllProjectsLite } from "../../../../features/workspace/projects/private/hooks/useAllProjectsLite";
import { getDocumentsFilterConfig } from "./filterConfig";
import { getDocumentsSortConfig } from "./sortConfig";

/**
 * Cross-project "every document I can see" view -- same recipe as
 * MyTasks.jsx. canRemove here only covers self-uploaded documents (not
 * "or an elevated project member", unlike ProjectDocumentsTab) -- resolving
 * elevated status per-row would need a project_members fetch for every
 * distinct project on the page; an elevated member who needs to remove
 * someone else's document can still do so from that project's own
 * Documents tab, where membership is already loaded. RLS is the actual
 * enforcement either way.
 */
export default function Documents() {
  const { darkMode } = useTheme();
  const { employee } = useEmployee();
  const { projects } = useAllProjectsLite();
  const [pendingRemove, setPendingRemove] = useState(null);

  const {
    data: documents,
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
    isLoading,
    isFetching,
    error,
  } = useMyDocuments();

  const { removeDocument, removing } = useDocumentMutations();

  const filterConfig = getDocumentsFilterConfig({ projects });
  const sortOptions = getDocumentsSortConfig();

  const hasData = documents.length > 0;

  async function handleConfirmRemove() {
    await removeDocument(pendingRemove.id);
    setPendingRemove(null);
  }

  const linkedTaskCount = pendingRemove?.linked_task_count ?? 0;

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={FileIcon} current="Documents" />

          <CardWrapper>
            <PageTitle
              title="Documents"
              subtitle="Every document in the projects you're a member of."
            />

            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search documents..."
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
              <SortBar
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOptions={sortOptions}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
              />
            </PageHeader>

            <PageResult
              data={documents}
              totalCount={totalCount}
              page={page}
              setPage={setPage}
              totalPages={totalPages}
              error={error}
            />

            <CardLayout style="cardWrapperScroll generalCard cardPaddingSmall">
              {isLoading || isFetching ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : !hasData || error ? (
                <NoResult title="No documents found" />
              ) : (
                <CardLayout style="cardLayout1">
                  {documents.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      showProject
                      canRemove={doc.attached_by === employee?.id}
                      onRemove={setPendingRemove}
                    />
                  ))}
                </CardLayout>
              )}
            </CardLayout>

            <ActionModal
              open={!!pendingRemove}
              onClose={() => setPendingRemove(null)}
              title="Remove Document"
              description={
                linkedTaskCount > 0
                  ? `Are you sure you want to remove "${pendingRemove?.name}"? It is linked to ${linkedTaskCount} task(s) -- removing it will also remove those links. This does not delete the file from Google Drive.`
                  : `Are you sure you want to remove "${pendingRemove?.name}"? This does not delete the file from Google Drive.`
              }
              confirmText="Remove"
              loading={removing}
              onConfirm={handleConfirmRemove}
              modalType="delete"
            />
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
