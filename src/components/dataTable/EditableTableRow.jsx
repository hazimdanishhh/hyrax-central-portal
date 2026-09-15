import { useForm } from "react-hook-form";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { useMessage } from "@/context/MessageContext";
import EditableField from "../crud/dataForm/EditableField";
import Button from "../buttons/button/Button";
import {
  resolveColumnValue,
  resolveDisplayValue,
} from "@/features/_shared/resolveColumnValue";

function getDefaultValues(row, columns) {
  const initial = {};
  columns.forEach((col) => {
    if (col.computed) return; // query-time embed, never a real editable field
    initial[col.key] = resolveColumnValue(row, col) ?? "";
  });
  return initial;
}

/**
 * The single row currently in edit mode (DataTable renders at most one of
 * these at a time -- see its `editingRowId` prop). Mounts its own scoped
 * react-hook-form instance reusing EditableField (the same validation/editor
 * wiring DataForm.jsx uses for the sidebar), so a field edited here and a
 * field edited in the sidebar run through byte-identical rules.
 */
export default function EditableTableRow({
  row,
  columns,
  hasFlagColumn,
  onSave,
  onCancel,
}) {
  const { showMessage } = useMessage();
  const { control, handleSubmit, watch, setValue, formState } = useForm({
    defaultValues: getDefaultValues(row, columns),
  });
  const currentFormValues = watch();

  const onValid = (data) => {
    const changedFields = {};
    Object.keys(formState.dirtyFields).forEach((key) => {
      changedFields[key] = data[key];
    });
    onSave({ row, changedFields });
  };

  const onInvalid = (errors) => {
    const firstErrorKey = Object.keys(errors)[0];
    const column = columns.find((c) => c.key === firstErrorKey);
    const message =
      errors[firstErrorKey]?.message || `${column?.label || "A field"} is required`;
    showMessage?.(message, "warning");
  };

  return (
    <tr className="editingRow">
      {hasFlagColumn && <td />}

      {columns.map((col) => {
        const rawValue = resolveColumnValue(row, col);

        if (col.render) {
          return <td key={col.key}>{col.render(rawValue, row)}</td>;
        }

        if (!col.editable) {
          const displayValue = resolveDisplayValue(row, col, rawValue);
          return (
            <td key={col.key}>
              <span>{displayValue ?? "—"}</span>
            </td>
          );
        }

        return (
          <td key={col.key}>
            <EditableField
              col={col}
              control={control}
              currentFormValues={currentFormValues}
              rowData={row}
              setValue={setValue}
              hideLabel
            />
          </td>
        );
      })}

      <td className="dataTableRowActions" onClick={(e) => e.stopPropagation()}>
        <Button
          icon={CheckIcon}
          style="button buttonType4 approval textXXS"
          onClick={handleSubmit(onValid, onInvalid)}
          size={16}
          title="Save"
        />
        <Button
          icon={XIcon}
          style="button buttonType4 rejection textXXS"
          onClick={onCancel}
          size={16}
          title="Cancel"
        />
      </td>
    </tr>
  );
}
