import { useState } from "react";
import { Link } from "react-router";
import StatusBox from "../../status/statusBox/StatusBox";
import IconCard from "../../iconCard/IconCard";
import Button from "../../buttons/button/Button";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import { ClockIcon, CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import {
  TASK_STATUSES,
  TASK_STATUS_TYPE,
  TASK_STATUS_ACTIONS,
} from "../../../features/workspace/tasks/private/taskStatusMeta";
import "./TaskCard.scss";

/**
 * Shared between the Project Tasks tab and My Tasks -- a single row (title,
 * status, due date, assignees, action buttons all always visible) with
 * only the description hidden behind a small expand toggle. A plain <div>
 * wrapper, NOT a <button> -- it nests other interactive elements (the
 * status-action Buttons, EmployeeImage's own Link, the expand toggle
 * itself), and a <button> can never legally contain another
 * <button>/focusable <a> (the browser silently reparents the inner one
 * out). Mirrors ITAssetList.jsx's own div-based clickable-row convention,
 * which nests EmployeeImage for the identical reason.
 *
 * Assignee avatars use EmployeeImage's normal Link-wrapped form (not a
 * plain image) with a real per-card hover-to-reveal-name state -- "view
 * their profile" and "click the row to open the task" coexist without
 * conflict via the Link's own stopPropagation.
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
}) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredAssigneeId, setHoveredAssigneeId] = useState(null);

  const statusLabel =
    TASK_STATUSES.find((s) => s.value === task.status)?.label || task.status;
  const actions = canEdit ? TASK_STATUS_ACTIONS[task.status] || [] : [];
  const assignees = task.task_assignees ?? [];

  return (
    <div className="generalCard taskCard cardPaddingSmall" onClick={onClick}>
      <div className="taskCardMainRow">
        <div className="taskCardTitleGroup">
          <p className="textBold textXS truncate" title={task.title}>
            {task.title}
          </p>
          {showProject && task.project?.name && (
            <Link
              to={`/app/workspace/projects/${task.project_id}`}
              className="textLight textXXS taskCardProjectLink"
              onClick={(e) => e.stopPropagation()}
            >
              {task.project.name}
            </Link>
          )}
        </div>

        <StatusBox
          status={statusLabel}
          type={TASK_STATUS_TYPE[task.status] || "grey"}
        />

        {task.due_date && (
          <IconCard
            icon={ClockIcon}
            weight="fill"
            name={`Due: ${task.due_date}`}
            style="yellow textXXS"
          />
        )}

        {assignees.length > 0 && (
          <div className="taskCardAssignees">
            {assignees.map((a) => (
              <EmployeeImage
                key={a.employee_id}
                employee={a.employee}
                employeeId={a.employee_id}
                showName={hoveredAssigneeId === a.employee_id}
                setShowName={(show) =>
                  setHoveredAssigneeId(show ? a.employee_id : null)
                }
              />
            ))}
          </div>
        )}

        {actions.length > 0 && (
          <div className="taskCardActions">
            {actions.map((action) => (
              <Button
                key={action.label}
                name={action.label}
                style={`button buttonType5 ${action.style} textXXS`}
                size={14}
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

        {task.description && (
          <button
            type="button"
            className="taskCardExpandToggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            title={expanded ? "Hide description" : "Show description"}
          >
            {expanded ? <CaretUpIcon size={16} /> : <CaretDownIcon size={16} />}
          </button>
        )}
      </div>

      {expanded && task.description && (
        <p className="textLight textXXS taskCardDescription">
          {task.description}
        </p>
      )}
    </div>
  );
}
