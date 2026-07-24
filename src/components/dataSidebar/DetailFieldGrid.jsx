// Read-only label/value grid for detail sidebars -- reuses DataSidebar.scss's
// existing .dataSidebarSectionFields/.dataSidebarField classes (normally
// populated by DataForm's editable inputs), just rendered as plain text.
export default function DetailFieldGrid({ fields = [] }) {
  return (
    <div className="dataSidebarSectionFields">
      {fields.map((field) => (
        <div
          key={field.label}
          className={`dataSidebarField ${field.half ? "half" : ""}`}
        >
          <label className="textBold textXXS">{field.label}</label>
          <span className="textRegular textXS">{field.value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
