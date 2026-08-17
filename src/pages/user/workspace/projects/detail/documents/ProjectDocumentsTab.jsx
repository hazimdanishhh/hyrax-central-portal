import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../../components/crud/pageHeader/PageHeader";
import ActionModal from "../../../../../../components/modals/actionModal/ActionModal";
import DocumentCard from "../../../../../../components/workspace/documentCard/DocumentCard";
import GoogleDrivePicker from "../../../../../../components/googleDrive/GoogleDrivePicker";
import SearchFilterBar from "../../../../../../components/searchFilterBar/SearchFilterBar";
import ActiveFiltersBar from "../../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import { useEmployee } from "../../../../../../context/EmployeeContext";
import { useProject } from "../../../../../../features/workspace/projects/private/hooks/useProject";
import { useProjectPermissions } from "../../../../../../features/workspace/projects/private/hooks/useProjectPermissions";
import { useProjectDocuments } from "../../../../../../features/workspace/tasks/private/hooks/useProjectDocuments";
import useDocumentMutations from "../../../../../../features/workspace/tasks/private/hooks/useDocumentMutations";
import { getProjectDocumentsFilterConfig } from "./filterConfig";

/**
 * The project's document library -- every document attached at the
 * project level and/or linked to any of its tasks, mirrors
 * ProjectTasksTab's own "show everything" shape for a single project's
 * scope. "Attach Document" (any working member, mirrors "Add Task"'s
 * exact gating) creates project-level documents with no task link;
 * linking a document to a specific task happens from that task's own
 * edit form instead. Removing a document here is a real delete from the
 * library (documents_crud.sql's DELETE policy: uploader or an elevated
 * member) -- confirmed product decision is to warn about the linked-task
 * count, then allow, not block.
 *
 * Search + "Attached By" filter are CLIENT-SIDE over the already
 * unpaginated `documents` array -- same reasoning and shape as
 * ProjectTasksTab.jsx's search/Assignee-filter (a single project's
 * document count is bounded, same as its task count). A "Project" filter
 * like the workspace Documents page has would be redundant here since
 * this tab is already scoped to one project -- Attached By is the
 * non-redundant dimension instead. `search`/`attachedBy` are read
 * straight from the URL via useSearchParams so the filtered view stays
 * shareable/bookmarkable.
 */
export default function ProjectDocumentsTab() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { employee } = useEmployee();
  const { members } = useProject(projectId);
  const permissions = useProjectPermissions(members);
  const { documents, isLoading, error } = useProjectDocuments(projectId);
  const { attachDocuments, attaching, removeDocument, removing } = useDocumentMutations(projectId);

  const [pendingRemove, setPendingRemove] = useState(null);

  const workingMembers = members.filter(
    (m) => m.role === "owner" || m.role === "lead" || m.role === "member",
  );

  const search = searchParams.get("search") || "";
  const attachedBy = searchParams.get("attachedBy") || "";
  const filters = { attachedBy };
  const filterConfig = getProjectDocumentsFilterConfig({ workingMembers });

  function updateParams(patch) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        Object.entries(patch).forEach(([key, value]) => {
          if (value === undefined || value === null || value === "") {
            params.delete(key);
          } else {
            params.set(key, String(value));
          }
        });
        return params;
      },
      { replace: true },
    );
  }

  const setSearch = (val) => updateParams({ search: val });
  const setFilters = (newFilters) => updateParams(newFilters);
  const resetParams = () => setSearchParams({});

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== "" && v != null);
  const hasActiveFilters = activeFilters.length > 0 || search.length > 0;

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (attachedBy && doc.attached_by !== attachedBy) return false;
      if (q && !(doc.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, attachedBy, search]);

  const hasData = filteredDocuments.length > 0;

  function handleAttach(files) {
    const picked = Array.isArray(files) ? files : [files];
    attachDocuments({ projectId, files: picked });
  }

  async function handleConfirmRemove() {
    await removeDocument(pendingRemove.id);
    setPendingRemove(null);
  }

  const linkedTaskCount = pendingRemove?.linked_task_count ?? 0;

  return (
    <>
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

      {permissions.isWorkingMember && (
        <PageHeader>
          <GoogleDrivePicker multiple label="Attach Document" onSelect={handleAttach} />
        </PageHeader>
      )}

      <CardLayout style="cardWrapperScroll generalCard cardPaddingSmall">
        {isLoading || attaching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData || error ? (
          <NoResult
            title={
              error
                ? "Error loading documents"
                : documents.length === 0
                  ? "No documents attached yet"
                  : "No documents match your search/filters"
            }
          />
        ) : (
          <CardLayout style="cardLayout1 cardGapSmall">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                canRemove={doc.attached_by === employee?.id || permissions.isElevated}
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
    </>
  );
}
