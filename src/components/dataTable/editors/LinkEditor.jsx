export default function LinkEditor({ value, onChange, onBlur }) {
  return (
    <input
      type="url"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoFocus
    />
  );
}
