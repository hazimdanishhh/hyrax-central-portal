import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Race-safe get-or-create against the project's document library --
 * delegates to the get_or_create_document() RPC rather than a plain
 * insert or .upsert() (see that function's own header comment for why:
 * .upsert() can't restrict which columns get overwritten on conflict,
 * which would corrupt attached_by/attached_at's "immutable audit fact"
 * convention on every re-pick of an already-attached file). attached_by
 * is resolved server-side by the RPC via current_employee_id() -- no
 * employeeId param needed here.
 */
export async function getOrCreateDocument({ projectId, driveFileId, name, url, mimeType, iconUrl }) {
  const { data, error } = await supabase.rpc("get_or_create_document", {
    p_project_id: projectId,
    p_drive_file_id: driveFileId,
    p_name: name,
    p_url: url,
    p_mime_type: mimeType || null,
    p_icon_url: iconUrl || null,
  });

  if (error) throw error;

  return data;
}

/**
 * Attach one or more freshly-picked Drive files directly to a project's
 * document library, with no task link -- backs the Project Documents
 * tab's "Attach Document" action. Looped (one RPC call per file) rather
 * than batched -- get_or_create_document() takes scalar params, matching
 * the expected scale of a handful of files per attach action.
 */
export async function attachProjectDocuments({ projectId, files = [] }) {
  const documents = [];

  for (const file of files) {
    const document = await getOrCreateDocument({
      projectId,
      driveFileId: file.id,
      name: file.name,
      url: file.url,
      mimeType: file.mimeType,
      iconUrl: file.iconUrl,
    });
    documents.push(document);
  }

  return documents;
}

/**
 * Hard delete -- removes the document from the project's library
 * entirely. Cascades to remove every task_documents link that pointed at
 * it (see documents_schema_migration.sql's header comment) -- confirmed
 * product decision: warn about the linked-task count client-side, then
 * allow, rather than block.
 */
export async function deleteDocument(id) {
  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) throw error;

  return true;
}
