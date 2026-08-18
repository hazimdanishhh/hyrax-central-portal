import { Link } from "react-router";
import { FileIcon, TrashSimpleIcon } from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import { formatDate } from "../../../functions/formatDate";
import "./DocumentCard.scss";

/**
 * Shared between the Project Detail Documents tab (project implied by the
 * page) and the Workspace Documents page (showProject on, cross-project).
 * A document can be linked to zero, one, or many tasks (documents_with_context's
 * linked_task_titles array) -- rendered as small non-clickable badges,
 * same as the earlier single-task link's own target (the generic project
 * Tasks tab, not a specific task's own detail view), so no navigation
 * capability is lost by dropping per-task links. `canRemove` gates the
 * delete button -- caller computes it client-side (attached_by === own
 * employee.id || isElevated), a UX mirror of documents_crud.sql's actual
 * DELETE policy, not the security boundary itself.
 */
export default function DocumentCard({ document, showProject = false, canRemove = false, onRemove }) {
  const linkedTaskTitles = document.linked_task_titles ?? [];

  return (
    <div className="generalCard documentCard cardPaddingSmall">
      <div className="documentCardMainRow">
        <div className="documentCardTitleGroup">
          {document.icon_url ? (
            <img src={document.icon_url} alt="" className="documentCardIcon" />
          ) : (
            <FileIcon size={20} />
          )}

          <div className="documentCardTitleText">
            <a href={document.url} target="_blank" rel="noreferrer" className="textBold textXS truncate" title={document.name}>
              {document.name}
            </a>

            <div className="documentCardMeta textLight textXXS">
              {showProject && document.project_id && (
                <Link
                  to={`/app/workspace/projects/${document.project_id}`}
                  className="documentCardLink"
                  onClick={(e) => e.stopPropagation()}
                >
                  {document.project_name}
                </Link>
              )}
              <span>
                Attached by {document.attached_by_name || "Unknown"} on {formatDate(document.attached_at)}
              </span>
            </div>

            {linkedTaskTitles.length > 0 && (
              <div className="documentCardTaskBadges">
                {linkedTaskTitles.map((title, i) => (
                  <span key={i} className="documentCardTaskBadge textXXXS">
                    {title}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {canRemove && (
          <Button
            icon={TrashSimpleIcon}
            style="button buttonType5 rejection textXXS"
            size={14}
            onClick={() => onRemove?.(document)}
            title="Remove document"
          />
        )}
      </div>
    </div>
  );
}
