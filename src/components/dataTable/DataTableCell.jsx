import { useState, useEffect } from "react";
import { editors } from "./editors/Editors";

export default function DataTableCell({
  row,
  rowId,
  column,
  isEditing,
  rawValue,
  displayValue,
  startEdit,
  onSave,
}) {
  const [localValue, setLocalValue] = useState(rawValue ?? "");

  // Sync when edit starts
  useEffect(() => {
    if (isEditing) {
      setLocalValue(
        column.editor === "select" && rawValue != null
          ? String(rawValue)
          : (rawValue ?? ""),
      );
    }
  }, [isEditing, rawValue, column.editor]);

  if (column.render) {
    return <td>{column.render(displayValue, row)}</td>;
  }

  if (!column.editable) {
    return (
      <td>
        <input disabled value={displayValue ?? ""} />
      </td>
    );
  }

  if (isEditing) {
    const Editor = editors[column.editor] ?? editors.text;

    return (
      <td>
        <Editor
          value={localValue}
          options={column.options}
          onChange={setLocalValue}
          onBlur={() => onSave(localValue)}
          autoFocus
        />
      </td>
    );
  }

  return (
    <td>
      <input
        readOnly
        value={displayValue ?? ""}
        onClick={() => startEdit(rowId, column, rawValue)}
      />
    </td>
  );
}
