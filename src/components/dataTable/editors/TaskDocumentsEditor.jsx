import { forwardRef } from "react";
import Select from "react-select";
import { FileIcon, XIcon } from "@phosphor-icons/react";
import GoogleDrivePicker from "../../googleDrive/GoogleDrivePicker";
import "./TaskDocumentsEditor.scss";

/**
 * value: mixed array of link entries -- {document_id, drive_file_id, name,
 * url, mime_type, icon_url} for an already-existing project document, or
 * {drive_file_id, name, url, mime_type, icon_url} (no document_id yet) for
 * a freshly-picked Drive file. ProjectTasksTab.jsx/MyTasks.jsx's
 * syncTaskDocumentLinks resolves the latter into real documents rows on
 * save (via get_or_create_document), then diffs task_documents links --
 * this editor only manages the staged list, no DB writes of its own.
 *
 * options: the project's full existing document library (from
 * useProjectDocuments), offered via a multi-select for LINKING a document
 * that's already attached to the project (by someone, to some other task,
 * or to no task at all) -- distinct from the Drive picker below, which
 * ATTACHES a brand-new file to the project's library.
 */
const TaskDocumentsEditor = forwardRef(({ value, onChange, options = [], readOnly }, ref) => {
  const documents = Array.isArray(value) ? value : [];
  const linkedDocumentIds = new Set(documents.map((d) => d.document_id).filter(Boolean));
  const linkableOptions = options
    .filter((opt) => !linkedDocumentIds.has(opt.id))
    .map((opt) => ({ value: opt.id, label: opt.name, document: opt }));

  function handleLinkExisting(selectedOptions) {
    const additions = (selectedOptions || []).map((opt) => ({
      document_id: opt.document.id,
      drive_file_id: opt.document.drive_file_id,
      name: opt.document.name,
      url: opt.document.url,
      mime_type: opt.document.mime_type,
      icon_url: opt.document.icon_url,
    }));
    onChange([...documents, ...additions]);
  }

  function handlePickedNew(files) {
    const picked = Array.isArray(files) ? files : [files];
    const existingDriveIds = new Set([
      ...documents.map((d) => d.drive_file_id),
      ...options.map((o) => o.drive_file_id),
    ]);
    const additions = picked
      .filter((f) => !existingDriveIds.has(f.id))
      .map((f) => ({
        drive_file_id: f.id,
        name: f.name,
        url: f.url,
        mime_type: f.mimeType,
        icon_url: f.iconUrl,
      }));
    if (additions.length) onChange([...documents, ...additions]);
  }

  function handleRemove(entry) {
    onChange(
      documents.filter((d) =>
        entry.document_id ? d.document_id !== entry.document_id : d.drive_file_id !== entry.drive_file_id,
      ),
    );
  }

  return (
    <div className="taskDocumentsEditor" ref={ref}>
      {documents.length > 0 && (
        <ul className="taskDocumentsEditorList">
          {documents.map((doc) => (
            <li key={doc.document_id || doc.drive_file_id} className="taskDocumentsEditorItem">
              {doc.icon_url ? (
                <img src={doc.icon_url} alt="" className="taskDocumentsEditorIcon" />
              ) : (
                <FileIcon size={16} />
              )}
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="textXXS truncate taskDocumentsEditorName"
                title={doc.name}
              >
                {doc.name}
              </a>
              {!readOnly && (
                <button
                  type="button"
                  className="taskDocumentsEditorRemove"
                  onClick={() => handleRemove(doc)}
                  title="Remove"
                >
                  <XIcon size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <>
          {linkableOptions.length > 0 && (
            <Select
              unstyled
              isMulti
              className="selectContainer"
              classNamePrefix="reactSelect"
              placeholder="Link an existing project document..."
              options={linkableOptions}
              value={[]}
              onChange={handleLinkExisting}
            />
          )}

          <GoogleDrivePicker multiple label="Attach from Drive" onSelect={handlePickedNew} />
        </>
      )}
    </div>
  );
});

TaskDocumentsEditor.displayName = "TaskDocumentsEditor";
export default TaskDocumentsEditor;
