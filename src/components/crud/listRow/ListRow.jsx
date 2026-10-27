// src/components/crud/listRow/ListRow.jsx
//
// One record in a list, in two lines (2026-10-27, DASHBOARD-CONVENTIONS §2b).
// Replaces the tall cards on list pages so a screen shows ~3x more records:
//
//   (face)  line 1   what the record is                the one figure the page counts   [buttons]
//           line 2   [status ▮▮▯] · who · dates · ...                   warning chips
//
//   * people   -- the face(s) on the left, so a column of faces can be scanned
//                 for "who's who" (one owner, or up to 3 members and "+N").
//   * progress -- a small step tracker inside the status chip (e.g. a lead's
//                 4 stages + outcome); the full tracker stays in the sidebar.
//   * actions  -- optional buttons on the right (e.g. a project's Members /
//                 Documents). They sit OUTSIDE the row's link, so pressing
//                 one never opens the record.
//
// The row itself is one link; everything else about the record opens in the
// page's sidebar. Each list writes its own small row (e.g. LeadRow) that
// decides what goes where -- this component only lays it out.
import { Link } from "react-router";
import Button from "../../buttons/button/Button";
import "./ListRow.scss";

const MAX_FACES = 3;

/** The list around the rows (one column; rows are never put in a grid). */
export function ListRows({ ariaLabel, children }) {
  return (
    <ul className="listRows" aria-label={ariaLabel}>
      {children}
    </ul>
  );
}

/**
 * A small coloured pill: tone is blue / green / yellow / red / grey.
 * progress: { steps, done } draws that many segments, `done` of them filled.
 */
export function ListRowChip({ label, tone = "grey", title, progress }) {
  return (
    <span className={`listRowChip ${tone}`} title={title}>
      {label}
      {progress && progress.steps > 0 && (
        <span
          className="listRowProgress"
          aria-label={`Step ${progress.done} of ${progress.steps}`}
        >
          {Array.from({ length: progress.steps }, (_, i) => (
            <span
              key={i}
              className={`listRowProgressStep ${i < progress.done ? "done" : ""}`}
            />
          ))}
        </span>
      )}
    </span>
  );
}

function personName(person) {
  return person?.employee_name || person?.full_name || "Unassigned";
}

function Face({ person }) {
  return (
    <img
      className="listRowFace"
      src={person?.avatar_url || "/profilePhoto/default.webp"}
      alt={personName(person)}
      title={personName(person)}
      loading="lazy"
    />
  );
}

function Faces({ people }) {
  const shown = people.slice(0, MAX_FACES);
  const extra = people.length - shown.length;
  return (
    <span className={`listRowFaces ${people.length > 1 ? "stack" : ""}`}>
      {shown.map((person, i) => (
        <Face key={person?.id ?? i} person={person} />
      ))}
      {extra > 0 && (
        <span
          className="listRowFaceMore textXXXS textBold"
          title={people.slice(MAX_FACES).map(personName).join(", ")}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/**
 * @param to          link that opens the record (the page's sidebar route)
 * @param title       line 1, left: the record's name / number
 * @param figure      line 1, right: the one amount the page measures
 * @param figureTitle tooltip naming that figure ("Expected revenue")
 * @param people      faces on the left: [employee] (owner) or [..members]
 * @param status      line 2, first: { label, tone, title, progress } chip
 * @param meta        line 2: short texts, shown separated by "·"
 * @param flags       line 2, last: [{ label, tone, title }] warning chips
 * @param actions     buttons on the right: [{ icon, label, count, onClick }]
 * @param active      the record open in the sidebar right now
 * @param disabled    ignore clicks (while a save or delete is running)
 */
export default function ListRow({
  to,
  title,
  figure,
  figureTitle,
  people,
  status,
  meta = [],
  flags = [],
  actions = [],
  active = false,
  disabled = false,
}) {
  const metaItems = meta.filter(
    (item) => item !== null && item !== undefined && item !== false && item !== "",
  );
  const flagItems = flags.filter(Boolean);
  const actionItems = actions.filter(Boolean);

  return (
    <li className={`listRow ${active ? "active" : ""}`}>
      <Link
        to={to}
        className="listRowBody"
        aria-current={active ? "true" : undefined}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
      >
        {people && <Faces people={people} />}

        <span className="listRowText">
          <span className="listRowMain">
            <span className="listRowTitle textXS textBold">{title}</span>
            {figure !== undefined && figure !== null && (
              <span className="listRowFigure textXS textBold" title={figureTitle}>
                {figure}
              </span>
            )}
          </span>

          <span className="listRowMeta textXXXS textLight">
            {status && <ListRowChip {...status} />}
            {metaItems.map((item, index) => (
              <span key={index} className="listRowMetaItem">
                {item}
              </span>
            ))}
            {flagItems.map((flag) => (
              <ListRowChip key={flag.label} {...flag} />
            ))}
          </span>
        </span>
      </Link>

      {actionItems.length > 0 && (
        <span className="listRowActions">
          {actionItems.map((action) => (
            <Button
              key={action.label}
              icon2={action.icon}
              name={action.count !== undefined ? String(action.count) : undefined}
              title={action.label}
              size={16}
              style="iconButton2 textXXXS"
              onClick={action.onClick}
            />
          ))}
        </span>
      )}
    </li>
  );
}
