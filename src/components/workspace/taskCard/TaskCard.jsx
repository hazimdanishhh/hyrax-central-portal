import { useState } from "react";
import { Link } from "react-router";
import { AnimatePresence } from "framer-motion";
import StatusBox from "../../status/statusBox/StatusBox";
import IconCard from "../../iconCard/IconCard";
import Button from "../../buttons/button/Button";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import DataSidebar from "../../dataSidebar/DataSidebar";
import ProjectMemberAvatarStack from "../projectMemberAvatarStack/ProjectMemberAvatarStack";
import TaskDocumentsIndicator from "../taskDocumentsIndicator/TaskDocumentsIndicator";
import {
  ClockIcon,
  WarningCircleIcon,
  UsersIcon,
  FolderIcon,
  ListChecksIcon,
} from "@phosphor-icons/react";
import {
  TASK_STATUSES,
  TASK_STATUS_TYPE,
  TASK_STATUS_ACTIONS,
} from "../../../features/workspace/tasks/private/taskStatusMeta";
import { getDueDateStatus } from "../../../functions/dueDateStatus";
import { formatDate } from "../../../functions/formatDate";
import "./TaskCard.scss";
import StatusBadge from "../../status/statusBadge/StatusBadge";

/**
 * Shared between the Project Tasks tab and My Tasks -- a single row (title,
 * status, due date, assignees, documents, action buttons all always
 * visible). A plain <div> wrapper, NOT a <button> -- it nests other
 * interactive elements (the status-action Buttons, the assignee/document
 * indicators), and a <button> can never legally contain another
 * <button>/focusable <a> (the browser silently reparents the inner one
 * out). Mirrors ITAssetList.jsx's own div-based clickable-row convention.
 *
 * Assignees and linked documents use the same "one click target opens a
 * read-only sidebar" indicators as ProjectCard (ProjectMemberAvatarStack /
 * TaskDocumentsIndicator), not per-item links -- consistent affordance
 * across both cards, and both stopPropagation so "view assignees/documents"
 * and "click the row to open the task" coexist without conflict.
 *
 * `canEdit` (req #6 -- only a task's own assignees can act on it) gates
 * the quick status-transition buttons; a row someone can't act on
 * shouldn't offer actions that will just fail server-side. `showProject`
 * renders the parent project as its own stopPropagation'd link -- on for
 * My Tasks (cross-project), off for the Project Tasks tab (redundant
 * there).
 */
export default function TaskCard({
  task,
  canEdit = true,
  showProject = false,
  onClick,
  onRequestStatusChange,
  showDescription = true,
}) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const [hoveredAssigneeId, setHoveredAssigneeId] = useState(null);

  const statusLabel =
    TASK_STATUSES.find((s) => s.value === task.status)?.label || task.status;
  const actions = canEdit ? TASK_STATUS_ACTIONS[task.status] || [] : [];
  const assignees = task.task_assignees ?? [];
  // Same shape taskTableConfig's own `documents` column reads -- already
  // embedded on the task row, no extra fetch needed (see
  // TaskDocumentsIndicator's own doc comment).
  const documents = (task.task_documents ?? []).map((td) => ({
    document_id: td.document_id,
    drive_file_id: td.document?.drive_file_id,
    name: td.document?.name,
    url: td.document?.url,
    mime_type: td.document?.mime_type,
    icon_url: td.document?.icon_url,
  }));
  const dueDateStatus = getDueDateStatus(
    task.due_date,
    task.status,
    task.is_completed_late,
  );

  return (
    <>
      <div className="generalCard taskCard cardPaddingSmall" onClick={onClick}>
        <div className="taskCardMainRow">
          <div
            className={`taskCardTitleGroup ${task.status === "CANCELLED" ? "taskCancelled" : null}`}
          >
            <div
              style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}
            >
              {actions.length > 0 && (
                <div className="taskCardActions">
                  {actions.map((action) => (
                    <Button
                      key={action.label}
                      style={`button buttonType5 ${action.style} textXXS`}
                      icon={action.icon}
                      size={14}
                      weight="bold"
                      title={action.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestStatusChange?.(
                          task,
                          action.nextStatus,
                          action.label,
                        );
                      }}
                    />
                  ))}
                </div>
              )}
              <p className="textBold textXS" title={task.title}>
                {task.title}
              </p>
            </div>

            {showProject && task.project?.name && (
              <Link
                to={`/app/workspace/projects/${task.project_id}`}
                className="textLight textXXS taskCardProjectLink"
                onClick={(e) => e.stopPropagation()}
              >
                <FolderIcon size={14} />
                {task.project.name}
              </Link>
            )}

            {showDescription && task.description && (
              <p className="textLight textXXS taskCardDescription">
                {task.description}
              </p>
            )}
          </div>

          <div className="taskCardStatusWrapper">
            <div className="taskCardStatusGroup">
              <StatusBadge
                status={statusLabel}
                type={TASK_STATUS_TYPE[task.status] || "grey"}
              />

              {task.due_date && (
                <IconCard
                  icon={
                    dueDateStatus.isOverdue || dueDateStatus.isCompletedLate
                      ? WarningCircleIcon
                      : ClockIcon
                  }
                  weight="fill"
                  name={`Due: ${formatDate(task.due_date)}`}
                  style={`${dueDateStatus.colorClass} textXXS`}
                />
              )}
            </div>

            {(actions.length > 0 ||
              assignees.length > 0 ||
              documents.length > 0) && (
              <div className="taskCardRightGroup">
                {(assignees.length > 0 || documents.length > 0) && (
                  <div className="taskCardIndicators">
                    {assignees.length > 0 && (
                      <ProjectMemberAvatarStack
                        members={assignees}
                        onClick={() => setRosterOpen(true)}
                        title="View Task Assignees"
                      />
                    )}
                    <TaskDocumentsIndicator
                      documents={documents}
                      taskTitle={task.title}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {rosterOpen && (
          <DataSidebar
            title={`${task.title} — Assignees`}
            icon={UsersIcon}
            open={rosterOpen}
            onClose={() => setRosterOpen(false)}
            isEditing={false}
            hideDelete
          >
            <div className="taskCardRosterPanel">
              <p className="textBold textXS">
                {assignees.length} Assignee{assignees.length !== 1 ? "s" : ""}
              </p>

              {assignees.map((a) => (
                <div
                  key={a.employee_id}
                  className="generalCard cardPaddingSmall taskCardRosterRow"
                >
                  <EmployeeImage
                    employee={a.employee}
                    displayName
                    showName={hoveredAssigneeId === a.employee_id}
                    setShowName={(show) =>
                      setHoveredAssigneeId(show ? a.employee_id : null)
                    }
                  />
                  {a.employee?.department_name && (
                    <StatusBox
                      status={a.employee.department_name}
                      type="grey"
                    />
                  )}
                </div>
              ))}
            </div>
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
