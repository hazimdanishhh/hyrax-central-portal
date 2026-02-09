import { useState } from "react";

// EditableCell.jsx
export default function EditableCell({ row, column, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");

  const startEditing = () => setEditing(true);
  const save = () => {
    let finalValue = editValue;
    if (column.editor === "number") finalValue = Number(editValue);
    if (
      column.editor === "select" &&
      column.options?.some((o) => typeof o.value === "number")
    ) {
      finalValue = Number(editValue);
    }
    onSave({ row, column, value: finalValue });
    setEditing(false);
  };

  if (!editing) {
    // Render display
    if (column.editor === "select") {
      const label =
        column.options?.find((opt) => String(opt.value) === String(value))
          ?.label ?? "";
      return <div onClick={startEditing}>{label}</div>;
    }
    return <div onClick={startEditing}>{value}</div>;
  }

  // Render editor
  switch (column.editor) {
    case "text":
      return (
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          autoFocus
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          autoFocus
        />
      );
    case "select":
      return (
        <select
          value={String(editValue)}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          autoFocus
        >
          <option value="" />
          {column.options?.map((opt) => (
            <option key={opt.value} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "textarea":
      return (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          autoFocus
        />
      );
    default:
      return (
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          autoFocus
        />
      );
  }
}
