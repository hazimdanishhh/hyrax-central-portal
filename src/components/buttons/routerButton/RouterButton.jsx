import { Link } from "react-router";
import "../button/Button.scss";

function RouterButton({ to, name, icon, onClick, style, size }) {
  const Icon = icon;

  return (
    <Link to={to} className={style} onClick={onClick}>
      {name}
      {icon && <Icon size={size ? size : 16} />}
    </Link>
  );
}

export default RouterButton;
