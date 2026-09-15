import { Link } from "react-router";
import "../button/Button.scss";

function RouterButton({ to, name, icon, onClick, style, size, target, rel }) {
  const Icon = icon;

  return (
    <Link to={to} className={style} onClick={onClick} target={target} rel={rel}>
      {name}
      {icon && <Icon size={size ? size : 16} />}
    </Link>
  );
}

export default RouterButton;
