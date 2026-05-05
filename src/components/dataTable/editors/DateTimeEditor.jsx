export default function DateTimeEditor({
  value,
  onChange,
  onBlur,
  required,
  readOnly,
}) {
  function formatForInput(val) {
    if (!val) return "";

    const date = new Date(val);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function handleChange(newValue) {
    if (!newValue) {
      onChange(null);
      return;
    }

    // Convert local input to ISO string for Supabase timestamptz
    const iso = new Date(newValue).toISOString();

    onChange(iso);
  }

  return (
    <div className="editorContainer">
      <input
        type="datetime-local"
        value={formatForInput(value)}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        readOnly={readOnly}
      />
    </div>
  );
}
