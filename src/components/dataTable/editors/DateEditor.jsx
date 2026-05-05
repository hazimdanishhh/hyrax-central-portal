export default function DateEditor({
  value,
  onChange,
  onBlur,
  required,
  readOnly,
}) {
  return (
    <div className="editorContainer">
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        readOnly={readOnly}
      />
    </div>
  );
}
