// components/attendanceActivityClockin/AttendanceActivityClockin.jsx

import { AnimatePresence, motion } from "framer-motion";
import {
  BuildingOfficeIcon,
  CalendarDotsIcon,
  ClockUserIcon,
  FactoryIcon,
  FingerprintSimpleIcon,
  HouseIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import Button from "../../buttons/button/Button";
import DataSidebar from "../../dataSidebar/DataSidebar";
import useAttendanceTypes from "../../../hooks/useAttendanceTypes";
import { attendanceActivityConfig } from "../../../data/attendanceActivityConfig";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import useAttendanceActivityMutations from "../../../hooks/useAttendanceActivityMutations";
import useEmployee from "../../../hooks/useEmployee";
import CardLayout from "../../cardLayout/CardLayout";
import { useMessage } from "../../../context/MessageContext";
import { useAttendance } from "../../../context/AttendanceProvider";

export default function ClockinMini({ navIsOpen }) {
  const { darkMode, toggleMode } = useTheme();
  const { showMessage } = useMessage;

  const [selectedAttendanceActivity, setSelectedAttendanceActivity] =
    useState(null);
  const [attendanceSidebarOpen, setAttendanceSidebarOpen] = useState(false);
  const [selectedAttendanceType, setSelectedAttendanceType] = useState(null);
  const [creatingAttendanceActivity, setCreatingAttendanceActivity] =
    useState(false);

  // Fetch Data
  const { employee, loading: employeeLoading } = useEmployee();
  const { attendanceTypes, loading: attendanceTypesLoading } =
    useAttendanceTypes();

  const { currentActivity, refetchCurrent } = useAttendance();

  // Attendance Activity Config
  const columns = attendanceActivityConfig({
    attendanceTypes,
  });

  // IT Asset Update and Delete Hook Function
  const {
    createAttendanceActivity,
    clockOutAttendanceActivity,
    saving,
    deleting,
    error,
  } = useAttendanceActivityMutations();

  async function handleSaveSidebar(data) {
    if (!employee?.id) {
      showMessage("Employee not found", "error");
      return;
    }

    // Attach employee_id here
    await createAttendanceActivity({
      ...data,
      employee_id: employee.id, // <-- attach current employee
    });

    setAttendanceSidebarOpen(false);
    refetchCurrent();
  }

  return (
    <>
      {/* ATTENDANCE ACTIVITY BUTTON */}
      {currentActivity ? (
        <Button
          style="button buttonType2Clockout textBold textXXS"
          icon={ClockUserIcon}
          name={navIsOpen ? "Clock Out" : null}
          onClick={async () => {
            if (!currentActivity?.id) return;
            console.log("Current:", currentActivity);
            await clockOutAttendanceActivity(currentActivity.id);
            await refetchCurrent();
          }}
        />
      ) : (
        <Button
          style="button buttonType2Clockin textBold textXXS"
          icon={ClockUserIcon}
          name={navIsOpen ? "Clock In" : null}
          onClick={() => {
            setSelectedAttendanceActivity({});
            setAttendanceSidebarOpen(true);
            setCreatingAttendanceActivity(true);
          }}
        />
      )}

      {/* BUTTON V2 */}

      {currentActivity && navIsOpen ? (
        <CardLayout key={currentActivity.id} style="cardLayout1">
          <CardLayout style="cardLayoutFlexFull generalCard">
            <div className="attendanceTypeHeader">
              {currentActivity?.attendance_type?.name === "Office" ? (
                <BuildingOfficeIcon size={20} />
              ) : currentActivity?.attendance_type?.name === "Site Visit" ? (
                <FactoryIcon size={20} />
              ) : currentActivity?.attendance_type?.name ===
                "Work From Home" ? (
                <HouseIcon size={20} />
              ) : (
                <BuildingOfficeIcon size={20} />
              )}
              <p className="textBold">
                {currentActivity?.attendance_type?.name}
              </p>
            </div>
            <p className="textLight textXXS">
              {currentActivity.clocked_in_time}
            </p>
          </CardLayout>
        </CardLayout>
      ) : null}

      <AnimatePresence>
        {attendanceSidebarOpen &&
          (attendanceTypesLoading ? (
            <LoadingIcon />
          ) : (
            <DataSidebar
              title="Attendance Activity"
              icon={CalendarDotsIcon}
              open={attendanceSidebarOpen}
              onClose={() => {
                setAttendanceSidebarOpen(false);
                setSelectedAttendanceType(null);
              }}
              rowData={selectedAttendanceType}
              columns={columns}
              onSave={handleSaveSidebar}
              creating={creatingAttendanceActivity}
            />
          ))}
      </AnimatePresence>
    </>
  );
}
