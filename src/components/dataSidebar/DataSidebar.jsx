// /components/dataSidebar/DataSidebar.jsx
import { useState, useEffect, useRef } from "react";
import { editors } from "../dataTable/editors/Editors";
import "./DataSidebar.scss";
import Button from "../buttons/button/Button";
import { useTheme } from "../../context/ThemeContext";
import { CheckIcon, TrashSimpleIcon, XIcon } from "@phosphor-icons/react";
import CardLayout from "../cardLayout/CardLayout";
import SectionHeader from "../sectionHeader/SectionHeader";
import { motion } from "framer-motion";
import { useMessage } from "../../context/MessageContext";

export default function DataSidebar({
  title,
  icon,
  open,
  onClose,
  rowData = {},
  columns = [],
  onSave,
  onDelete,
  creating,
  children,
  saving,
  deleting,
}) {
  const { darkMode } = useTheme();
  const { showMessage } = useMessage();
  const [localData, setLocalData] = useState({});
  const prevIdRef = useRef(null);

  // ==============
  // SYNC ROW DATA WHEN OPENING
  // ==============
  // useEffect(() => {
  //   if (open) {
  //     const initial = {};
  //     columns.forEach((col) => {
  //       const rawValue =
  //         typeof col.getValue === "function"
  //           ? col.getValue(rowData)
  //           : typeof col.getValue === "string"
  //             ? rowData[col.getValue]
  //             : typeof col.accessor === "function"
  //               ? col.accessor(rowData)
  //               : typeof col.accessor === "string"
  //                 ? rowData[col.accessor]
  //                 : "";
  //       initial[col.key] = rawValue ?? "";
  //     });
  //     setLocalData(initial);
  //   }
  // }, [open, rowData, columns]);

  useEffect(() => {
    if (!open) return;

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
  }, [open, rowData?.id]);

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
    // onClose?.();
  }

  // ==============
  // HANDLE DELETE
  // ==============
  function handleDelete() {
    onDelete?.(rowData);
  }

  return (
    <motion.div
      className="dataSidebarOverlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={
          darkMode ? "dataSidebar sectionDark" : "dataSidebar sectionLight"
        }
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{
          type: "tween",
          duration: 0.12,
          ease: "easeOut",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <CardLayout>
          <header className="dataSidebarHeader">
            <SectionHeader title={title} icon={icon} />
            <Button icon={XIcon} style="iconButton" onClick={onClose} />
          </header>

          {children}

          <form
            className="dataSidebarContent"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            {columns.map((col) => {
              if (!col.editable) return null;

              const Editor = editors[col.editor] ?? editors.text;
              const value = localData[col.key];

              return (
                <div key={col.key} className="dataSidebarField">
                  <label className="textBold textXXS">
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
                  />
                </div>
              );
            })}

            <footer className="dataSidebarFooter">
              {!creating && (
                <Button
                  name="Delete"
                  icon={TrashSimpleIcon}
                  style="button buttonTypeDelete textXS"
                  onClick={handleDelete}
                  disabled={deleting}
                  type="button"
                />
              )}
              <Button
                name="Save"
                icon={CheckIcon}
                style="button buttonType2 textXS"
                onClick={handleSave}
                type="submit"
                disabled={saving}
              />
            </footer>
          </form>
        </CardLayout>
      </motion.div>
    </motion.div>
  );
}
