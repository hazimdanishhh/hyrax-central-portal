export default function SelectEditor({
  value,
  options = [],
  onChange,
  onBlur,
  required,
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      required={required}
    >
      <option value="" />

      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
