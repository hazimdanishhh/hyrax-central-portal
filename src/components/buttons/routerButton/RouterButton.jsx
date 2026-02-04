import { Link } from "react-router";
import "../button/Button.scss";

function RouterButton({ to, name, icon, onClick, style }) {
  const Icon = icon;

  return (
    <Link to={to} className={style} onClick={onClick}>
      {name}
      {icon && <Icon />}
    </Link>
  );
}

export default RouterButton;
