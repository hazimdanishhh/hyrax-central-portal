import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { fetchMyDocuments } from "../api/myDocumentsService";

/**
 * Cross-project "every document I can see" view, backing the Workspace
 * Documents page. No employeeId gating (unlike useMyTasks) -- RLS does the
 * membership scoping, see fetchMyDocuments' header comment.
 */
export function useMyDocuments() {
  return usePaginatedQuery({
    queryKey: "myDocuments",
    queryFn: fetchMyDocuments,
    pageSize: 20,
    defaultSortBy: "attached_at",
    defaultSortOrder: "descending",
  });
}
