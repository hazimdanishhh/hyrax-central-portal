import { useState, useEffect } from "react";
import { editors } from "../dataTable/editors/Editors";
import "./DataSidebar.scss";
import Button from "../buttons/button/Button";
import { useTheme } from "../../context/ThemeContext";
import { PencilSimpleLine, X } from "phosphor-react";
import CardLayout from "../cardLayout/CardLayout";
import SectionHeader from "../sectionHeader/SectionHeader";

export default function DataSidebar({
  open,
  onClose,
  rowData = {},
  columns = [],
  onSave,
  onDelete,
}) {
  const { darkMode } = useTheme();

  const [localData, setLocalData] = useState({});

  // Sync rowData when opening
  useEffect(() => {
    if (open) {
      const initial = {};
      columns.forEach((col) => {
        const rawValue =
          typeof col.getValue === "function"
            ? col.getValue(rowData)
            : typeof col.getValue === "string"
              ? rowData[col.getValue]
              : typeof col.accessor === "function"
                ? col.accessor(rowData)
                : typeof col.accessor === "string"
                  ? rowData[col.accessor]
                  : "";
        initial[col.key] = rawValue ?? "";
      });
      setLocalData(initial);
    }
  }, [open, rowData, columns]);

  function handleChange(key, value) {
    setLocalData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave?.(localData);
    onClose?.();
  }

  function handleDelete() {
    if (confirm("Are you sure you want to delete this item?")) {
      onDelete?.(rowData);
      onClose?.();
    }
  }

  if (!open) return null;

  return (
    <div className="dataSidebarOverlay" onClick={onClose}>
      <div
        className={
          darkMode ? "dataSidebar sectionDark" : "dataSidebar sectionLight"
        }
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <CardLayout>
          <header className="dataSidebarHeader">
            <SectionHeader title="Edit IT Asset" icon={PencilSimpleLine} />
            <Button icon={X} style="iconButton" onClick={onClose} />
          </header>

          <div className="dataSidebarContent">
            {columns.map((col) => {
              if (!col.editable) return null;

              const Editor = editors[col.editor] ?? editors.text;
              const value = localData[col.key];

              return (
                <div key={col.key} className="dataSidebarField">
                  <label>{col.label}</label>
                  <Editor
                    value={value}
                    options={col.options}
                    onChange={(v) => handleChange(col.key, v)}
                  />
                </div>
              );
            })}
          </div>

          <footer className="dataSidebarFooter">
            <Button
              name="Delete"
              style="button buttonTypeDelete"
              onClick={handleDelete}
            />
            <Button
              name="Save"
              style="button buttonType1"
              onClick={handleSave}
            />
          </footer>
        </CardLayout>
      </div>
    </div>
  );
}
