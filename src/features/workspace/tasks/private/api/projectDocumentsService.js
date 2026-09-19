import { supabase } from "../../../../../lib/supabaseClient";
import { fetchAllSupabaseRows } from "../../../../../functions/fetchAllSupabaseRows";

/**
 * Unpaginated (no page/pageSize UI) -- mirrors fetchTasksByProject's "show
 * everything" precedent for a single project's scope. Reads
 * documents_with_context (the project's document library, each row already
 * carrying its aggregated linked-task ids/titles) so no client-side task/
 * project join is needed.
 *
 * Uses fetchAllSupabaseRows (see tasksByProjectService.js's own comment for
 * why) rather than a single unbounded .select() -- `id` (confirmed present
 * on this view, see documents_views.sql) tie-breaks after attached_at for a
 * fully deterministic pagination order.
 */
export async function fetchProjectDocuments(projectId) {
  return fetchAllSupabaseRows(() =>
    supabase
      .from("documents_with_context")
      .select("*")
      .eq("project_id", projectId)
      .order("attached_at", { ascending: false })
      .order("id", { ascending: true }),
  );
}
