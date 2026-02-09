// components/dataTable/DataTable.jsx
import "./DataTable.scss";
import { useState } from "react";

export default function DataTable({ data = [], columns = [], rowKey = "id" }) {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");

  function renderEditor({ col, value: editValue, row, onChange, onSave }) {
    switch (col.editor) {
      case "number":
        return (
          <input
            type="number"
            value={editValue ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
            autoFocus
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={editValue ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
            autoFocus
          />
        );

      case "select":
        return (
          <select
            value={editValue ?? ""} // ensure this is string
            onChange={(e) => onChange(e.target.value)} // keep string
            onBlur={onSave}
            autoFocus
          >
            <option value="" />
            {col.options?.map((opt) => (
              <option key={opt.value} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "textarea":
        return (
          <textarea
            value={editValue ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
            autoFocus
          />
        );

      case "link":
        return (
          <input
            type="url"
            value={editValue ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
            autoFocus
          />
        );

      default:
        return (
          <input
            value={editValue ?? ""}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
            autoFocus
          />
        );
    }
  }

  return (
    <div className="dataTableWrapper">
      <table className="dataTable">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((col) => {
                const rawValue =
                  typeof col.accessor === "function"
                    ? col.accessor(row)
                    : row[col.accessor];

                const displayValue = col.displayAccessor
                  ? col.displayAccessor(row)
                  : rawValue;

                return (
                  <td key={col.key}>
                    {col.render ? (
                      col.render(displayValue, row)
                    ) : col.editable ? (
                      editingCell?.rowId === row[rowKey] &&
                      editingCell?.columnKey === col.key ? (
                        renderEditor({
                          col,
                          value: editValue,
                          row,
                          onChange: setEditValue,
                          onSave: () => {
                            const val = col.options?.some(
                              (o) => typeof o.value === "number",
                            )
                              ? Number(editValue)
                              : editValue;
                            col.onSave?.({ row, value: val, column: col });
                            setEditingCell(null);
                          },
                        })
                      ) : (
                        <input
                          readOnly
                          value={displayValue ?? ""}
                          onClick={() => {
                            setEditingCell({
                              rowId: row[rowKey],
                              columnKey: col.key,
                            });
                            let initialValue = rawValue ?? "";

                            if (col.editor === "select") {
                              // Convert to string to match <option value>
                              initialValue =
                                rawValue != null ? String(rawValue) : "";
                            }

                            setEditValue(initialValue);
                          }}
                        />
                      )
                    ) : (
                      <input disabled value={displayValue ?? ""} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
