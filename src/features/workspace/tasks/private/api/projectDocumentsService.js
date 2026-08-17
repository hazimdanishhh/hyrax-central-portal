import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Unpaginated -- mirrors fetchTasksByProject's "show everything" precedent
 * for a single project's scope. Reads documents_with_context (the
 * project's document library, each row already carrying its aggregated
 * linked-task ids/titles) so no client-side task/project join is needed.
 */
export async function fetchProjectDocuments(projectId) {
  const { data, error } = await supabase
    .from("documents_with_context")
    .select("*")
    .eq("project_id", projectId)
    .order("attached_at", { ascending: false });

  if (error) throw error;

  return data || [];
}
