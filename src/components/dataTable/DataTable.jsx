import "./DataTable.scss";
import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  CaretUpIcon,
  CaretDownIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { useMessage } from "../../context/MessageContext";
import DataTableCell from "./DataTableCell";
import EditableTableRow from "./EditableTableRow";
import RowFlagBadge from "./RowFlagBadge";
import Button from "../buttons/button/Button";
import { toTanstackColumns } from "./tanstackColumnAdapter";
import {
  resolveColumnValue,
  resolveDisplayValue,
} from "@/features/_shared/resolveColumnValue";
import { getMissingFields } from "@/features/_shared/getMissingFields";

export default function DataTable({
  data = [],
  columns = [],
  rowKey = "id",
  onRowClick,

  // Multi-column server-side sorting (optional, additive) -- `sorting` is a
  // TanStack SortingState array ([{id, desc}]), driven by a page's
  // usePaginatedQuery. manualSorting tells TanStack "don't sort `data`
  // yourself, it already arrived sorted from the server" -- see
  // docs plan: sorting/pagination both stay server-side at any table size.
  sorting,
  onSortingChange,
  manualSorting = false,

  // Row-level inline editing (optional, additive) -- omitted entirely by
  // every page not opting in, so their rendered output is unchanged.
  editableRows = false,

  // Per-row flag column (optional, additive) -- `showCompleteness` is sugar
  // for the original "missing required fields" rule (getMissingFields.js);
  // `getRowFlags(row, columns) => string[]` lets any page supply its own
  // rule instead (e.g. Payroll Export's "needs reconciliation"), with
  // `flagIcon`/`flagTooltipTitle` to relabel the badge for that rule.
  showCompleteness = false,
  getRowFlags,
  flagIcon,
  flagTooltipTitle,

  onRequestRowSave,
  editingRowId: controlledEditingRowId,
  onEditingRowIdChange,
}) {
  const { showMessage } = useMessage();
  const [internalEditingRowId, setInternalEditingRowId] = useState(null);

  const resolveRowFlags = getRowFlags || (showCompleteness ? getMissingFields : null);
  const hasFlagColumn = Boolean(resolveRowFlags);
  // Keep the original "Missing fields" heading for the showCompleteness
  // sugar path when the caller doesn't override it; a custom getRowFlags
  // rule without an explicit title falls back to the generic "Flagged".
  const resolvedFlagTooltipTitle =
    flagTooltipTitle || (getRowFlags ? "Flagged" : "Missing fields");

  const editingRowId =
    controlledEditingRowId !== undefined
      ? controlledEditingRowId
      : internalEditingRowId;

  function setEditingRowId(id) {
    if (onEditingRowIdChange) onEditingRowIdChange(id);
    else setInternalEditingRowId(id);
  }

  const sortingEnabled = manualSorting && typeof onSortingChange === "function";

  const tanstackColumns = useMemo(() => toTanstackColumns(columns), [columns]);

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting: sorting ?? [] },
    onSortingChange,
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: true,
    getCoreRowModel: getCoreRowModel(),
  });

  function handleEditRow(rowId) {
    if (editingRowId != null && editingRowId !== rowId) {
      showMessage?.("Discarded unsaved changes", "info");
    }
    setEditingRowId(rowId);
  }

  function handleCancelEdit() {
    setEditingRowId(null);
  }

  function handleSaveRow({ row, changedFields }) {
    if (!changedFields || Object.keys(changedFields).length === 0) {
      setEditingRowId(null);
      return;
    }
    onRequestRowSave?.({ row, changedFields, columns });
  }

  return (
    <div className="dataTableWrapperScroll">
      <table className="dataTable">
        <thead>
          <tr>
            {hasFlagColumn && <th className="dataTableFlagHeader" />}

            {sortingEnabled
              ? table.getHeaderGroups()[0].headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  const sortIndex = header.column.getSortIndex();
                  const isRequired = header.column.columnDef.meta?.required;

                  return (
                    <th
                      key={header.id}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      className={canSort ? "sortableHeader" : ""}
                    >
                      <span
                        className={`dataTableHeaderLabel ${isRequired ? "required" : ""}`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {isRequired && (
                          <span className="dataSidebarRequired">*</span>
                        )}
                        {canSort && (
                          <span className="dataTableSortIcons">
                            {sortDir === "asc" && (
                              <CaretUpIcon size={12} weight="bold" />
                            )}
                            {sortDir === "desc" && (
                              <CaretDownIcon size={12} weight="bold" />
                            )}
                            {sorting?.length > 1 && sortDir && (
                              <sup>{sortIndex + 1}</sup>
                            )}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })
              : columns.map((col) => (
                  <th key={col.key}>
                    <span
                      className={`dataTableHeaderLabel ${col.required ? "required" : ""}`}
                    >
                      {col.label}
                      {col.required && (
                        <span className="dataSidebarRequired">*</span>
                      )}
                    </span>
                  </th>
                ))}

            {editableRows && <th className="dataTableActionsHeader" />}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => {
            const rowId = row[rowKey];
            const isRowEditing = editableRows && editingRowId === rowId;

            if (isRowEditing) {
              return (
                <EditableTableRow
                  key={rowId}
                  row={row}
                  columns={columns}
                  hasFlagColumn={hasFlagColumn}
                  onSave={handleSaveRow}
                  onCancel={handleCancelEdit}
                />
              );
            }

            return (
              <tr
                key={rowId}
                className={onRowClick ? "clickableRow" : ""}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {hasFlagColumn && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <RowFlagBadge
                      items={resolveRowFlags(row, columns)}
                      icon={flagIcon}
                      tooltipTitle={resolvedFlagTooltipTitle}
                    />
                  </td>
                )}

                {columns.map((col) => {
                  const rawValue = resolveColumnValue(row, col);
                  const displayValue = resolveDisplayValue(row, col, rawValue);

                  return (
                    <DataTableCell
                      key={col.key}
                      column={col}
                      row={row}
                      displayValue={displayValue}
                    />
                  );
                })}

                {editableRows && (
                  <td
                    className="dataTableRowActions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      icon={PencilSimpleIcon}
                      style="button buttonType4 textXXS"
                      onClick={() => handleEditRow(rowId)}
                      size={16}
                      title="Edit"
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
