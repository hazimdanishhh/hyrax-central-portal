import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import {
  CheckIcon,
  PencilSimpleIcon,
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
}) {
  const { darkMode } = useTheme();
  const { showMessage } = useMessage();
  const [localData, setLocalData] = useState({});
  const prevIdRef = useRef(null);

  // ==============
  // SYNC ROW DATA WHEN OPENING
  // ==============
  useEffect(() => {
    const currentId = rowData?.id ?? "new";

    // only reinitialize when opening or switching record
    if (prevIdRef.current === currentId) return;

    prevIdRef.current = currentId;

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

    setLocalData(initial);
  }, [rowData?.id, columns]);

  // ==============
  // GROUP COLUMNS BY SECTION
  // ==============
  const groupedColumns = columns.reduce((acc, col) => {
    const section = col.section || "Details";

    if (!acc[section]) {
      acc[section] = [];
    }

    acc[section].push(col);

    return acc;
  }, {});

  // ==============
  // HANDLE CHANGE
  // ==============
  function handleChange(key, value) {
    setLocalData((prev) => ({ ...prev, [key]: value }));
  }

  // ==============
  // HANDLE SAVE
  // ==============
  function handleSave() {
    for (const col of columns) {
      if (col.required && !localData[col.key]) {
        showMessage(`${col.label} is required`, "warning");
        return;
      }
    }

    onSave?.(localData);
  }

  // ==============
  // HANDLE DELETE
  // ==============
  function handleDelete() {
    onDelete?.(rowData);
  }

  // ==============
  // HANDLE CANCEL
  // ==============
  function handleCancel() {
    onCancel?.();
  }

  return (
    <form
      className={`dataSidebarContent ${inlineForm ? "inlineForm" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      {Object.entries(groupedColumns).map(([section, fields]) => (
        <div key={section} className="dataSidebarSection">
          <div className="dataSidebarSectionFields cardStyle">
            <div className="dataSidebarSectionHeader">
              <IconCard
                icon={PencilSimpleIcon}
                name={section}
                style="textXS textBold"
                weight="fill"
              />
            </div>

            {fields.map((col) => {
              const Editor = editors[col.editor] ?? editors.text;
              const value = localData[col.key];

              if (col.show === false) return null;

              if (!col.editable)
                return (
                  <div
                    key={col.key}
                    className={`dataSidebarField ${col.half ? "half" : ""}`}
                  >
                    <label
                      className={
                        col.required
                          ? "textBold textXXS required"
                          : "textBold textXXS"
                      }
                    >
                      {col.label}
                      <span className="dataSidebarRequired">
                        {col.required && "*"}
                      </span>
                    </label>

                    <Editor
                      value={value}
                      options={col.options}
                      required={col.required}
                      isSearchable={col.isSearchable}
                      readOnly={true}
                      min={col.min}
                      max={col.max}
                      step={col.step}
                      isClearable={col.isClearable}
                    />
                  </div>
                );

              return (
                <div
                  key={col.key}
                  className={`dataSidebarField ${col.half ? "half" : ""}`}
                >
                  <label
                    className={
                      col.required
                        ? "textBold textXXS required"
                        : "textBold textXXS"
                    }
                  >
                    {col.label}

                    <span className="dataSidebarRequired">
                      {col.required && "*"}
                    </span>
                  </label>

                  <Editor
                    value={value}
                    options={col.options}
                    onChange={(v) => handleChange(col.key, v)}
                    required={col.required}
                    isSearchable={col.isSearchable}
                    min={col.min}
                    max={col.max}
                    step={col.step}
                    isClearable={col.isClearable}
                  />
                </div>
              );
            })}
          </div>

          {/* FOOTER FOR INLINE FORM */}
          {inlineForm && (
            <div className="dataFormFooter">
              <Button
                name="Cancel"
                icon={XIcon}
                style="button buttonType5 textXXS textRegular"
                onClick={handleCancel}
                type="button"
                disabled={saving}
                size="14"
                weight="bold"
              />
              {!creating && (
                <Button
                  name="Delete"
                  icon={TrashSimpleIcon}
                  style="button buttonType5 rejection textXXS textRegular"
                  onClick={handleDelete}
                  disabled={deleting}
                  type="button"
                  size="14"
                  weight="bold"
                />
              )}
              <Button
                name="Save"
                icon={CheckIcon}
                style="button buttonType5 approval textXXS textRegular"
                onClick={handleSave}
                type="submit"
                disabled={saving}
                size="14"
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
              style="button buttonType5 textXXS textRegular"
              onClick={handleCancel}
              type="button"
              disabled={saving}
              size="14"
              weight="bold"
            />
          )}
          {!creating && (
            <Button
              name="Delete"
              icon={TrashSimpleIcon}
              style="button buttonType5 rejection textXXS textRegular"
              onClick={handleDelete}
              disabled={deleting}
              type="button"
              size="14"
              weight="bold"
            />
          )}
          {!cannotUpdate && (
            <Button
              name="Save"
              icon={CheckIcon}
              style="button buttonType5 approval textXXS textRegular"
              onClick={handleSave}
              type="submit"
              disabled={saving}
              size="14"
              weight="bold"
            />
          )}
        </footer>
      )}
    </form>
  );
}

export default DataForm;
