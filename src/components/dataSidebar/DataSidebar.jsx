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
import DataForm from "../crud/dataForm/DataForm";

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
  cannotUpdate,
  isEditing = true,
  onCancel,
  fullPage = false,
}) {
  const { darkMode } = useTheme();

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
        className={`dataSidebar ${darkMode ? "sectionDark" : "sectionLight"} ${fullPage ? "fullPage" : ""}`}
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
          <header
            className={
              darkMode
                ? "sectionDark dataSidebarHeader"
                : "sectionLight dataSidebarHeader"
            }
          >
            <SectionHeader title={title} icon={icon} />
            <Button icon={XIcon} style="iconButton" onClick={onClose} />
          </header>

          {isEditing && (
            <DataForm
              key={rowData?.id || "new-record"}
              columns={columns}
              rowData={rowData}
              onSave={onSave}
              onDelete={onDelete}
              onCancel={onCancel}
              creating={creating}
              saving={saving}
              deleting={deleting}
              cannotUpdate={cannotUpdate}
            />
          )}

          {children}
        </CardLayout>
      </motion.div>
    </motion.div>
  );
}
