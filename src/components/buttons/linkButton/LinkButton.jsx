import "../button/Button.scss";

// `nestedLink` mirrors SAPCustomerCard.jsx/EmployeeImage.jsx's own prop --
// pass false when this is rendered inside a card that's itself a <Link>
// (e.g. LeadsList.jsx's footer), so this renders as a <button> that opens
// the same external URL instead of an invalid nested <a>.
export default function LinkButton({
  href,
  name,
  icon,
  onClick,
  style,
  size,
  nestedLink = true,
}) {
  const Icon = icon;

  if (nestedLink === false) {
    return (
      <button
        type="button"
        className={style}
        title={name}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
          window.open(href, "_blank", "noopener,noreferrer");
        }}
      >
        {name}
        {icon && <Icon size={size ?? (name ? "20" : "24")} />}
      </button>
    );
  }

  return (
    <a
      href={href}
      className={style}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      title={name}
    >
      {name}
      {icon && <Icon size={size ?? (name ? "20" : "24")} />}
    </a>
  );
}
