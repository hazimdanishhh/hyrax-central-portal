import "../statusBox/StatusBox.scss";

// STATUS BOX
// RED, GREEN, YELLOW, GREY, BLUE
export default function StatusIcon({ status, type, icon }) {
  const Icon = icon;
  return (
    <div className={`textBold textXXXS statusBox ${type}`}>
      <Icon size={16} weight="fill" />
      <p className="textBold textXXXS statusName">{status || "No Status"}</p>
    </div>
  );
}
