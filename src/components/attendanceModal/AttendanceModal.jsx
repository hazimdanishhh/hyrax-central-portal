import { useState } from "react";
import "./AttendanceModal.scss";
import Button from "../buttons/button/Button";
import { SignInIcon, XIcon } from "@phosphor-icons/react";
import SectionHeader from "../sectionHeader/SectionHeader";
import { motion } from "framer-motion";
import PageHeader from "../crud/pageHeader/PageHeader";
import { useTheme } from "../../context/ThemeContext";
import useAttendanceTypes from "../../hooks/useAttendanceTypes";
import LoadingIcon from "../loadingIcon/LoadingIcon";
import { attendanceTypesConfig } from "./attendanceActivityConfig";

function AttendanceModal({ setAttendanceModalIsOpen }) {
  const { darkMode } = useTheme();
  const { attendanceTypes, loading: attendanceTypesLoading } =
    useAttendanceTypes();

  // Table Config
  const columns = attendanceTypesConfig({
    departments,
  });

  // Return Loading
  if (attendanceTypesLoading) {
    return <LoadingIcon />;
  }

  return (
    <motion.div
      className={
        darkMode
          ? "attendanceModal sectionDark"
          : "attendanceModal sectionLight"
      }
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageHeader>
        <SectionHeader title="Attendance Activity" icon={SignInIcon} />
        <Button
          onClick={() => setAttendanceModalIsOpen(false)}
          icon={XIcon}
          style="iconButton"
        />
      </PageHeader>
    </motion.div>
  );
}

export default AttendanceModal;
