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
  // GROUP COLUMNS BY SECTION
  // ==============
  const groupedColumns = columns.reduce((acc, col) => {
    const section = col.section || "Details";
    if (!acc[section]) acc[section] = [];
    acc[section].push(col);
    return acc;
  }, {});

  // ==============
  // SUBMIT HANDLER
  // ==============
  const onSubmit = (data) => {
    onSave?.(data);
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
              if (col.show === false) return null;

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
