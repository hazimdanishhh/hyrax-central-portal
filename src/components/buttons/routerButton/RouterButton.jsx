import { Link } from "react-router";
import "../button/Button.scss";

function RouterButton({ to, name, icon, onClick, style, size, target, rel }) {
  const Icon = icon;

  // react-router's <Link> throws in resolveTo when `to` is null/undefined, and
  // several link builders here return null for an unresolvable target (an
  // unknown category, a missing employee id). Rendering nothing is the right
  // degradation: it matches the "non-clickable when the target isn't available"
  // convention supabase/access-control/README.md already mandates for
  // permission-denied drill-throughs.
  if (!to) return null;

  return (
    <Link to={to} className={style} onClick={onClick} target={target} rel={rel}>
      {name}
      {icon && <Icon size={size ? size : 16} />}
    </Link>
  );
}

export default RouterButton;
