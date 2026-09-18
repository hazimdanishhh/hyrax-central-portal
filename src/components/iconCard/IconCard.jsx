import "./IconCard.scss";

function IconCard({ name, icon, style, size, weight, title }) {
  const Icon = icon;

  return (
    <div className={`iconCardContainer ${style}`} title={title}>
      {icon && <Icon size={size ? size : 16} weight={weight} />}
      <span>{name}</span>
    </div>
  );
}

export default IconCard;
