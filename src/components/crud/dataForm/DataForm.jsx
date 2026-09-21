import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import {
  CheckIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  TrashSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import { useMessage } from "../../../context/MessageContext";
import Breadcrumbs from "../../breadcrumbs/Breadcrumbs";
import IconCard from "../../iconCard/IconCard";
import PageHeader from "../pageHeader/PageHeader";
import "./DataForm.scss";
import SectionHeader from "../../sectionHeader/SectionHeader";
import { useForm } from "react-hook-form";
import EditableField from "./EditableField";
import { resolveColumnValue } from "@/features/_shared/resolveColumnValue";

function DataForm({
  columns = [],
  rowData = {},
  onSave,
  onDelete,
  onCancel,
  creating,
  saving,
  deleting,
  cannotUpdate,
  hideDelete = false,
  inlineForm = false,
  title,
}) {
  const { darkMode } = useTheme();
  const { showMessage } = useMessage();

  // ==============
  // INITIALIZE DEFAULT VALUES
  // ==============
  // This runs once when the component mounts (driven by the parent's `key` prop)
  const getDefaultValues = () => {
    const initial = {};
    columns.forEach((col) => {
      if (col.computed) return; // server-computed/view-only field -- never seed into RHF state so it can never leak into submitted form data (see progress_percentage)
      initial[col.key] = resolveColumnValue(rowData, col) ?? "";
    });
    return initial;
  };

  // ==============
  // REACT HOOK FORM SETUP
  // ==============
  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: getDefaultValues(),
  });

  // Watch all current values so we can pass them to dependent fields
  const currentFormValues = watch();

  // ==============
  // FIELD VISIBILITY
  // ==============
  /**
   * `show` may be a plain boolean (the long-standing behaviour: only an
   * explicit `false` hides a column) or a function of the live form values,
   * for a field whose relevance depends on another field's current value --
   * e.g. clock in/out times, which are meaningless once the chosen attendance
   * type is a whole-day one.
   *
   * `col.show !== false` is the exact negation of the previous
   * `if (col.show === false) return null`, so every existing config behaves
   * identically -- all of them pass a boolean resolved at config-build time.
   */
  const isColumnVisible = (col) =>
    typeof col.show === "function"
      ? !!col.show(currentFormValues, rowData)
      : col.show !== false;

  // ==============
  // GROUP COLUMNS BY SECTION
  // ==============
  // Filtered BEFORE grouping, so a section whose every field is hidden
  // disappears entirely rather than rendering an empty header card. Inert for
  // the existing configs (their hidden `id` columns share a section with
  // visible fields), but load-bearing the moment a whole section is
  // conditional.
  const groupedColumns = columns.filter(isColumnVisible).reduce((acc, col) => {
    const section = col.section || "Details";
    if (!acc[section]) acc[section] = [];
    acc[section].push(col);
    return acc;
  }, {});

  // ==============
  // SUBMIT HANDLER
  // ==============
  const onSubmit = (data) => {
    // A field hidden by a FUNCTION `show` is dropped from the payload.
    // react-hook-form defaults to shouldUnregister: false, so an unmounted
    // field keeps its last value in form state and would otherwise still be
    // submitted -- e.g. a clock-in time typed before switching to a
    // whole-day attendance type. Deliberately scoped to the function form:
    // statically hidden columns (`show: false` ids, `show: !creating`) MUST
    // keep submitting, since that is how the update target reaches onSave.
    const submitted = { ...data };
    columns.forEach((col) => {
      if (typeof col.show === "function" && !isColumnVisible(col)) {
        delete submitted[col.key];
      }
    });

    onSave?.(submitted);
  };

  const onError = (errors) => {
    // RHF handles validation, we just pop the toast for the first error.
    // errors[key]?.message is only populated when a `validate` rule
    // returned a string (RHF's own convention) -- fall back to the
    // generic "required" wording when it's a plain `required` failure
    // instead, which carries no message of its own.
    const firstErrorKey = Object.keys(errors)[0];
    const column = columns.find((c) => c.key === firstErrorKey);
    const message =
      errors[firstErrorKey]?.message || `${column?.label || "A field"} is required`;
    showMessage(message, "warning");
  };

  return (
    <form
      className={`dataSidebarContent ${inlineForm ? "inlineForm" : ""}`}
      onSubmit={handleSubmit(onSubmit, onError)}
    >
      {title && <SectionHeader title={title} icon={PlusCircleIcon} />}

      {Object.entries(groupedColumns).map(([section, fields]) => (
        <div key={section} className="dataSidebarSection">
          <div className="dataSidebarSectionFields cardStyle">
            <div className="dataSidebarSectionHeader">
              <IconCard
                icon={PencilSimpleIcon}
                name={section}
                style="textXS textBold"
              />
            </div>

            {fields.map((col) => {
              return (
                <EditableField
                  key={col.key}
                  col={col}
                  control={control}
                  currentFormValues={currentFormValues}
                  rowData={rowData}
                  setValue={setValue}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* FOOTER FOR INLINE FORM */}
      {inlineForm && (
        <div className="dataFormFooter">
          {/* Note: Update your Button types to ensure Save is type="submit" and Cancel/Delete are type="button" */}
          <Button
            name="Cancel"
            icon={XIcon}
            onClick={onCancel}
            type="button"
            disabled={saving}
            size="14"
            style="button buttonType5 textXXS textRegular"
            weight="bold"
          />
          {!creating && !hideDelete && (
            <Button
              name="Delete"
              icon={TrashSimpleIcon}
              onClick={() => onDelete?.(rowData)}
              type="button"
              disabled={deleting}
              size="14"
              style="button buttonType5 rejection textXXS textRegular"
              weight="bold"
            />
          )}
          <Button
            name="Save"
            icon={CheckIcon}
            type="submit"
            disabled={saving}
            size="14"
            style="button buttonType5 approval textXXS textRegular"
            weight="bold"
          />
        </div>
      )}

      {/* SIDEBAR FOOTER */}
      {!inlineForm && (
        <footer
          className={`dataSidebarFooter ${darkMode ? "sectionDark" : "sectionLight"}`}
        >
          {!creating && (
            <Button
              name="Cancel"
              icon={XIcon}
              onClick={onCancel}
              type="button"
              disabled={saving}
              size="14"
              style="button buttonType5 textXXS textRegular"
              weight="bold"
            />
          )}
          {!creating && !hideDelete && (
            <Button
              name="Delete"
              icon={TrashSimpleIcon}
              onClick={(e) => {
                e.preventDefault();
                onDelete?.(rowData);
              }}
              type="button"
              disabled={deleting}
              size="14"
              style="button buttonType5 rejection textXXS textRegular"
              weight="bold"
            />
          )}
          {!cannotUpdate && (
            <Button
              name="Save"
              icon={CheckIcon}
              type="submit"
              disabled={saving}
              size="14"
              style="button buttonType5 approval textXXS textRegular"
              weight="bold"
            />
          )}
        </footer>
      )}
    </form>
  );
}

export default DataForm;
