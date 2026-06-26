import "./SectionHeader.scss";

function SectionHeader({ icon, title, style }) {
  const Icon = icon;
  return (
    <div className="sectionHeader">
      {Icon && <Icon size="16" weight="bold" />}
      <p className={`textBold textXXS ${style}`}>{title}</p>
    </div>
  );
}

export default SectionHeader;
