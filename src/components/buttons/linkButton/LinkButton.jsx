import "../button/Button.scss";

export default function LinkButton({ href, name, icon, onClick, style }) {
  const Icon = icon;

  return (
    <a
      href={href}
      className={style}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
    >
      {name}
      {icon && <Icon />}
    </a>
  );
}
