import { supabase } from "../../../../../lib/supabaseClient";
import { getOrCreateDocument } from "./documentMutations";

/**
 * Syncs a task's linked documents against the editor's submitted value --
 * a mix of already-existing project documents (carry a `document_id`) and
 * freshly-picked Drive files that don't exist as `documents` rows yet
 * (no `document_id`, resolved here via get_or_create_document() before
 * diffing). Same diff-and-sync shape as taskAssigneesMutations.js's
 * syncTaskAssignees, just against the task_documents junction instead of
 * task_assignees, and never deletes the underlying `documents` row --
 * only the link.
 */
export async function syncTaskDocumentLinks({ taskId, projectId, documents = [] }) {
  const resolvedIds = [];

  for (const doc of documents) {
    if (doc.document_id) {
      resolvedIds.push(doc.document_id);
      continue;
    }

    const created = await getOrCreateDocument({
      projectId,
      driveFileId: doc.drive_file_id,
      name: doc.name,
      url: doc.url,
      mimeType: doc.mime_type,
      iconUrl: doc.icon_url,
    });
    resolvedIds.push(created.id);
  }

  const { data: current, error: fetchError } = await supabase
    .from("task_documents")
    .select("document_id")
    .eq("task_id", taskId);

  if (fetchError) throw fetchError;

  const currentIds = new Set(current.map((d) => d.document_id));
  const nextIds = new Set(resolvedIds);

  const toAdd = resolvedIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toAdd.length) {
    const { error } = await supabase
      .from("task_documents")
      .insert(toAdd.map((document_id) => ({ task_id: taskId, document_id })));
    if (error) throw error;
  }

  if (toRemove.length) {
    const { error } = await supabase
      .from("task_documents")
      .delete()
      .eq("task_id", taskId)
      .in("document_id", toRemove);
    if (error) throw error;
  }
}
