import { useQuery } from "@tanstack/react-query";
import { fetchProjectById } from "../api/projectsService";

/**
 * Single-project fetch, incl. its member roster. Called independently by
 * ProjectDetailLayout and each of its tabs -- useOutletContext is unused
 * anywhere in this codebase, so tabs re-call this hook rather than
 * threading data through Outlet context; React Query dedupes the
 * identical ["project", projectId] key for free.
 *
 * A null result (no error, just no row) is the CORRECT behavior for "you
 * aren't a member of this project" once RLS is enforced -- a non-member's
 * request simply returns zero rows -- so callers render NoResult, not a
 * special-cased "unauthorized" branch.
 */
export function useProject(projectId) {
  const query = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProjectById(projectId),
    enabled: !!projectId,
  });

  return {
    ...query,
    project: query.data ?? null,
    members: query.data?.project_members ?? [],
  };
}
