/**
 * Read-only cell rendering only -- row-level editing (when a table opts
 * into it via DataTable's `editableRows` prop) is handled entirely by
 * EditableTableRow.jsx instead, which replaces this component's row for the
 * one currently-editing row. Previously this component also owned a
 * per-cell click-to-edit path, but its save callback silently discarded the
 * typed value (DataTable.jsx wired `onSave={() => saveEdit(row, col)}`,
 * dropping the value DataTableCell passed), and no page's tableConfig.jsx
 * ever defined `column.onSave` to receive it anyway -- dead code, removed
 * rather than patched.
 */
export default function DataTableCell({ column, row, displayValue }) {
  if (column.render) {
    return <td>{column.render(displayValue, row)}</td>;
  }

  return (
    <td>
      <span>{displayValue ?? "—"}</span>
    </td>
  );
}
