import "./DataTable.scss";
import { useState } from "react";
import DataTableCell from "./DataTableCell";

export default function DataTable({
  data = [],
  columns = [],
  rowKey = "id",
  onRowClick,
}) {
  const [editingCell, setEditingCell] = useState(null);

  function getRawValue(row, col) {
    if (typeof col.getValue === "function") {
      return col.getValue(row);
    }

    if (typeof col.getValue === "string") {
      return row[col.getValue];
    }

    if (typeof col.accessor === "function") {
      return col.accessor(row);
    }

    if (typeof col.accessor === "string") {
      return row[col.accessor];
    }

    return null;
  }

  function getDisplayValue(row, col, rawValue) {
    if (typeof col.displayValue === "function") {
      return col.displayValue(row);
    }

    if (typeof col.getDisplayValue === "function") {
      return col.getDisplayValue(row);
    }

    if (typeof col.displayAccessor === "function") {
      return col.displayAccessor(row);
    }

    return rawValue;
  }

  function startEdit(rowId, col) {
    setEditingCell({
      rowId,
      columnKey: col.key,
    });
  }

  function saveEdit(row, col, value) {
    let finalValue = value;

    if (
      col.editor === "select" &&
      col.options?.some((o) => typeof o.value === "number")
    ) {
      finalValue = Number(value);
    }

    col.onSave?.({
      row,
      value: finalValue,
      column: col,
    });

    setEditingCell(null);
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
          {data.map((row) => {
            const rowId = row[rowKey];

            return (
              <tr
                key={rowId}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? "clickableRow" : ""}
              >
                {columns.map((col) => {
                  const rawValue = getRawValue(row, col);
                  const displayValue = getDisplayValue(row, col, rawValue);

                  const isEditing =
                    editingCell?.rowId === rowId &&
                    editingCell?.columnKey === col.key;

                  return (
                    <DataTableCell
                      key={col.key}
                      row={row}
                      rowId={rowId}
                      column={col}
                      isEditing={isEditing}
                      rawValue={rawValue}
                      displayValue={displayValue}
                      startEdit={startEdit}
                      onSave={() => saveEdit(row, col)}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
