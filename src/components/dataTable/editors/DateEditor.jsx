export default function DateEditor({ value, onChange, onBlur }) {
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoFocus
    />
  );
}
