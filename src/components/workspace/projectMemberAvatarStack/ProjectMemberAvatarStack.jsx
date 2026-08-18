import "./ProjectMemberAvatarStack.scss";

const MAX_VISIBLE = 4;

/**
 * Overlapping avatar stack for ProjectCard -- deliberately plain <img>s,
 * not EmployeeImage's Link-wrapped version. Unlike TaskCard's assignee
 * avatars (each meant to independently link to that person's profile),
 * this whole stack has ONE click target -- opening the read-only member
 * roster -- so giving each avatar its own competing link here would be
 * the wrong affordance, not a bonus.
 */
export default function ProjectMemberAvatarStack({ members = [], onClick }) {
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
      title="View Project Members"
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
