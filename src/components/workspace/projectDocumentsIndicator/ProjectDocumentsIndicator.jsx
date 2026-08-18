import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { FileIcon } from "@phosphor-icons/react";
import DataSidebar from "../../dataSidebar/DataSidebar";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import NoResult from "../../crud/noResult/NoResult";
import DocumentCard from "../documentCard/DocumentCard";
import { useProjectDocuments } from "../../../features/workspace/tasks/private/hooks/useProjectDocuments";
import "./ProjectDocumentsIndicator.scss";

/**
 * Deliberately simpler than ProjectMemberAvatarStack -- "just a document
 * icon," no count badge, no previews. useProjectDocuments is only ever
 * called once `open` is true (mounted conditionally inside the
 * AnimatePresence block below), so this never fires an extra query for
 * every card in a list the way a preloaded avatar stack would -- the cost
 * of "simple" here is paid only by whoever actually clicks it.
 */
export default function ProjectDocumentsIndicator({ projectId, projectName }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="projectDocumentsIndicator"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="View project documents"
      >
        <FileIcon size={20} />
      </button>

      <AnimatePresence>
        {open && (
          <ProjectDocumentsIndicatorSidebar
            projectId={projectId}
            projectName={projectName}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ProjectDocumentsIndicatorSidebar({ projectId, projectName, onClose }) {
  const { documents, isLoading } = useProjectDocuments(projectId);

  return (
    <DataSidebar title={`${projectName} — Documents`} icon={FileIcon} open onClose={onClose} isEditing={false} hideDelete>
      <div className="projectDocumentsIndicatorPanel">
        {isLoading ? (
          <LoadingIcon />
        ) : documents.length === 0 ? (
          <NoResult title="No documents yet" />
        ) : (
          documents.map((doc) => <DocumentCard key={doc.id} document={doc} />)
        )}
      </div>
    </DataSidebar>
  );
}
