import "./Button.scss";

function Button({ onClick, name, style, icon, icon2, type, size }) {
  const Icon = icon;
  const Icon2 = icon2;

  return (
    <button onClick={onClick} className={style} type={type}>
      {icon2 && <Icon2 size={name ? "20" : "24"} />}
      {name}
      {icon && <Icon size={name ? "20" : size ? size : "24"} />}
    </button>
  );
}

export default Button;
