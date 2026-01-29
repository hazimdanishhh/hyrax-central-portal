import "./SectionHeader.scss";

function SectionHeader({ icon, title }) {
  const Icon = icon;
  return (
    <div className="sectionHeader">
      <Icon size="16" weight="bold" />
      <p className="textBold textXXS">{title}</p>
    </div>
  );
}

export default SectionHeader;
