export default function TextareaEditor({ value, onChange, onBlur }) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoFocus
    />
  );
}
