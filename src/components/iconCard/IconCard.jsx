import "./IconCard.scss";

function IconCard({ name, icon, style, size }) {
  const Icon = icon;

  return (
    <div className="iconCardContainer">
      {icon && <Icon size={size ? size : 16} />}
      <p className={style}>{name}</p>
    </div>
  );
}

export default IconCard;
