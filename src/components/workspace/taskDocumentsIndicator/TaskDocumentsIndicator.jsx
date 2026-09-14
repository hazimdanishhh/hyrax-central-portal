import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { FileIcon } from "@phosphor-icons/react";
import DataSidebar from "../../dataSidebar/DataSidebar";
import Button from "../../buttons/button/Button";
import "./TaskDocumentsIndicator.scss";
import DocumentCard from "../documentCard/DocumentCard";

/**
 * Task-level counterpart to ProjectDocumentsIndicator -- deliberately NOT a
 * data-fetching sidebar like that one: a task's linked documents
 * (task.task_documents) are already embedded on the task row TaskCard
 * receives (same shape taskTableConfig's own `documents` column reads),
 * so this is purely presentational -- no hook, no extra query per card.
 * Hidden entirely when there are none, unlike ProjectDocumentsIndicator
 * (which always shows -- it doesn't know the count until opened).
 */
export default function TaskDocumentsIndicator({ documents = [], taskTitle }) {
  const [open, setOpen] = useState(false);

  if (!documents.length) return null;

  return (
    <>
      <Button
        type="button"
        style="button buttonType5 blue textXXXS"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="View Task Documents"
        icon={FileIcon}
        size={16}
      />

      <AnimatePresence>
        {open && (
          <DataSidebar
            title={`${taskTitle} — Documents`}
            icon={FileIcon}
            open
            onClose={() => setOpen(false)}
            isEditing={false}
            hideDelete
          >
            <div className="taskDocumentsIndicatorPanel">
              <p className="textBold textXS">
                {documents.length} Document{documents.length !== 1 ? "s" : ""}
              </p>

              {documents.map((doc) => (
                <DocumentCard key={doc.id} document={doc} />
              ))}
            </div>
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
