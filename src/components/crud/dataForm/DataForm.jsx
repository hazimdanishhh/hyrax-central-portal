import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import {
  CheckIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  TrashSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { editors } from "../../dataTable/editors/Editors";
import Button from "../../buttons/button/Button";
import { useMessage } from "../../../context/MessageContext";
import Breadcrumbs from "../../breadcrumbs/Breadcrumbs";
import IconCard from "../../iconCard/IconCard";
import PageHeader from "../pageHeader/PageHeader";
import "./DataForm.scss";
import SectionHeader from "../../sectionHeader/SectionHeader";
import { useForm, Controller } from "react-hook-form";

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
      const rawValue =
        typeof col.getValue === "function"
          ? col.getValue(rowData)
          : typeof col.getValue === "string"
            ? rowData?.[col.getValue]
            : typeof col.accessor === "function"
              ? col.accessor(rowData)
              : typeof col.accessor === "string"
                ? rowData?.[col.accessor]
                : "";
      initial[col.key] = rawValue ?? "";
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
    // RHF handles validation, we just pop the toast for the first error
    const firstErrorKey = Object.keys(errors)[0];
    const column = columns.find((c) => c.key === firstErrorKey);
    showMessage(`${column?.label || "A field"} is required`, "warning");
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
              const Editor = editors[col.editor] ?? editors.text;
              if (col.show === false) return null;

              // 🔥 THE CACHE KILLER: Generate a dynamic React key based on dependencies
              const dependencyString = col.dependsOn
                ? col.dependsOn
                    .map((dep) => {
                      const val = currentFormValues[dep];
                      return typeof val === "object" ? val?.value : val;
                    })
                    .join("-")
                : "static";

              // Unique key forces React to destroy and remount the field if a dependency changes
              const componentKey = `${col.key}-${dependencyString}`;

              return (
                <div
                  key={col.key}
                  className={`dataSidebarField ${col.half ? "half" : ""}`}
                >
                  <label
                    className={`textBold textXXS ${col.required ? "required" : ""}`}
                  >
                    {col.label}
                    <span className="dataSidebarRequired">
                      {col.required && "*"}
                    </span>
                  </label>

                  <Controller
                    name={col.key}
                    control={control}
                    rules={{ required: col.required }}
                    render={({ field }) => (
                      <Editor
                        {...field}
                        key={componentKey} // Physically remounts to wipe AsyncSelect cache
                        // Pass current form values so config can extract clientId
                        loadOptions={
                          col.loadOptions
                            ? (search) =>
                                col.loadOptions(search, currentFormValues)
                            : undefined
                        }
                        options={
                          typeof col.options === "function"
                            ? col.options(currentFormValues)
                            : col.options
                        }
                        // Wrap onChange to handle your "clears" logic
                        onChange={(val) => {
                          field.onChange(val); // Standard RHF update
                          if (col.clears) {
                            col.clears.forEach((clearKey) =>
                              setValue(clearKey, null),
                            );
                          }
                        }}
                        required={col.required}
                        isSearchable={col.isSearchable}
                        readOnly={!col.editable}
                        min={col.min}
                        max={col.max}
                        step={col.step}
                        isClearable={col.isClearable}
                        cacheOptions={col.cacheOptions}
                      />
                    )}
                  />
                </div>
              );
            })}
          </div>

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
              {!creating && (
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
        </div>
      ))}

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
          {!creating && (
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
