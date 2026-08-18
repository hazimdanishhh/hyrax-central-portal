import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ClockIcon,
  WarningCircleIcon,
  UsersIcon,
  FolderIcon,
  ListChecksIcon,
} from "@phosphor-icons/react";
import CardLayout from "../../cardLayout/CardLayout";
import StatusBox from "../../status/statusBox/StatusBox";
import ProgressBar from "../../progressBar/ProgressBar";
import IconCard from "../../iconCard/IconCard";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import DataSidebar from "../../dataSidebar/DataSidebar";
import ProjectMemberAvatarStack from "../projectMemberAvatarStack/ProjectMemberAvatarStack";
import ProjectDocumentsIndicator from "../projectDocumentsIndicator/ProjectDocumentsIndicator";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_TYPE,
} from "../../../features/workspace/projects/private/projectStatusMeta";
import { PROJECT_ROLE_LABEL } from "../../../features/workspace/projects/private/projectRoleMeta";
import { getDueDateStatus } from "../../../functions/dueDateStatus";
import { formatDate } from "../../../functions/formatDate";
import "./ProjectCard.scss";
import StatusBadge from "../../status/statusBadge/StatusBadge";

/**
 * Simple Card-view counterpart to the Projects list -- a plain <div>
 * wrapper (NOT a <button>): it nests ProjectMemberAvatarStack, itself a
 * <button>, and a <button> can never legally contain another
 * <button>/focusable <a> (the browser silently reparents the inner one
 * out). Mirrors ITAssetList.jsx's own div-based clickable-row convention.
 * The member-avatar stack is its own click target (stopPropagation, see
 * ProjectMemberAvatarStack) that opens a read-only roster sidebar for a
 * quick view -- editing membership stays exclusive to the project's own
 * Members tab.
 */
export default function ProjectCard({ project, category, onClick }) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const [hoveredEmployeeId, setHoveredEmployeeId] = useState(null);
  const statusLabel =
    PROJECT_STATUSES.find((s) => s.value === project.status)?.label ||
    project.status;
  const members = project.project_members ?? [];
  const endDateStatus = getDueDateStatus(
    project.target_end_date,
    project.status,
  );

  return (
    <>
      <div className="generalCard projectCard" onClick={onClick}>
        <div className="projectCardHeader">
          <div className="projectCardTitle">
            <FolderIcon size={16} />
            <p className="textBold textXS truncate" title={project.name}>
              {project.name}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <StatusBadge
              status={statusLabel}
              type={PROJECT_STATUS_TYPE[project.status] || "grey"}
            />
            {category?.name && (
              <StatusBox status={category?.name} type="blue" />
            )}
          </div>
        </div>

        {project.description && (
          <p className="textLight textXXS projectCardDescription">
            {project.description}
          </p>
        )}

        <div className="projectCardMeta">
          <div className="projectCardDates">
            <IconCard
              icon={ClockIcon}
              weight="fill"
              name={`Start: ${formatDate(project.start_date)}`}
              style="blue textXXXS"
            />
            <IconCard
              icon={endDateStatus.isOverdue ? WarningCircleIcon : ClockIcon}
              weight="fill"
              name={`End: ${formatDate(project.target_end_date)}`}
              style={`${endDateStatus.colorClass} textXXXS`}
            />
            <IconCard
              icon={ListChecksIcon}
              weight="fill"
              name={`Tasks: ${project.completed_task_count ?? 0}/${project.active_task_count ?? 0}`}
              style="green textXXXS textBold"
            />
          </div>

          <div className="projectCardMetaActions">
            <ProjectMemberAvatarStack
              members={members}
              onClick={() => setRosterOpen(true)}
            />
            <ProjectDocumentsIndicator
              projectId={project.id}
              projectName={project.name}
            />
          </div>
        </div>

        <ProgressBar
          value={project.progress_percentage}
          label={`${project.name} progress`}
        />
      </div>

      <AnimatePresence>
        {rosterOpen && (
          <DataSidebar
            title={`${project.name} — Members`}
            icon={UsersIcon}
            open={rosterOpen}
            onClose={() => setRosterOpen(false)}
            isEditing={false}
            hideDelete
          >
            <div className="projectCardRosterPanel">
              <p className="textBold textXS">
                {members.length} Member{members.length !== 1 ? "s" : ""}
              </p>

              {members.map((m) => (
                <div
                  key={m.employee_id}
                  className="generalCard cardPaddingSmall projectCardRosterRow"
                >
                  <EmployeeImage
                    employee={m.employee}
                    displayName
                    showName={hoveredEmployeeId === m.employee_id}
                    setShowName={(show) =>
                      setHoveredEmployeeId(show ? m.employee_id : null)
                    }
                  />
                  {m.employee?.department_name && (
                    <StatusBox
                      status={m.employee.department_name}
                      type="grey"
                    />
                  )}
                  <StatusBox
                    status={
                      m.role === "owner" ? "Owner" : PROJECT_ROLE_LABEL[m.role]
                    }
                    type={
                      m.role === "owner"
                        ? "blue"
                        : m.role === "member"
                          ? "yellow"
                          : "green"
                    }
                  />
                </div>
              ))}
            </div>
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
