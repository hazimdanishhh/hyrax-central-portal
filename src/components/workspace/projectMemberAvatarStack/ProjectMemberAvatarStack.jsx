import "./ProjectMemberAvatarStack.scss";

const MAX_VISIBLE = 4;

/**
 * Overlapping avatar stack -- deliberately plain <img>s, not EmployeeImage's
 * Link-wrapped version: this whole stack has ONE click target -- opening a
 * read-only roster sidebar -- so giving each avatar its own competing link
 * would be the wrong affordance, not a bonus. Shared between ProjectCard
 * (its `project_members` rows) and TaskCard (its `task_assignees` rows) --
 * both shapes are just `{employee_id, employee}`, this component never
 * touches anything role-specific, so it's generic across the two despite
 * the folder/file name still saying "ProjectMember". `title` lets each
 * caller supply its own tooltip ("View Project Members" vs "View Task
 * Assignees").
 */
export default function ProjectMemberAvatarStack({
  members = [],
  onClick,
  title = "View Project Members",
}) {
  if (!members.length) return null;

  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - visible.length;

  return (
    <button
      type="button"
      className="projectMemberAvatarStack"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={title}
    >
      {visible.map((m) => (
        <img
          key={m.employee_id}
          className="projectMemberAvatarStackImage"
          src={m.employee?.avatar_url || "/profilePhoto/default.webp"}
          alt={m.employee?.full_name || "Member"}
        />
      ))}
      {overflow > 0 && (
        <div className="projectMemberAvatarStackOverflow textXXXS">
          +{overflow}
        </div>
      )}
    </button>
  );
}
