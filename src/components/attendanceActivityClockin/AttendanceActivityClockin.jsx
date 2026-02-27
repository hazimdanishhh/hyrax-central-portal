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
import { useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import Button from "../buttons/button/Button";
import DataSidebar from "../dataSidebar/DataSidebar";
import useAttendanceTypes from "../../hooks/useAttendanceTypes";
import { attendanceActivityConfig } from "../../data/attendanceActivityConfig";
import LoadingIcon from "../loadingIcon/LoadingIcon";
import useAttendanceActivityMutations from "../../hooks/useAttendanceActivityMutations";
import useEmployee from "../../hooks/useEmployee";
import CardLayout from "../cardLayout/CardLayout";
import useCurrentAttendanceActivity from "../../hooks/useCurrentAttendanceActivity";
import SectionHeader from "../sectionHeader/SectionHeader";
import "./AttendanceActivityClockin.scss";

export default function AttendanceActivityClockin() {
  const { darkMode, toggleMode } = useTheme();
  const [message, setMessage] = useState({ text: "", type: "" });

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

  const { currentActivity, refetchCurrent } = useCurrentAttendanceActivity(
    employee?.id,
  );

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
  } = useAttendanceActivityMutations({
    setMessage,
  });

  async function handleSaveSidebar(data) {
    if (!employee?.id) {
      setMessage({ type: "error", text: "Employee not found" });
      return;
    }

    try {
      // Attach employee_id here
      await createAttendanceActivity({
        ...data,
        employee_id: employee.id, // <-- attach current employee
      });

      setMessage({ type: "success", text: "Attendance saved successfully." });
      setAttendanceSidebarOpen(false);
      refetchCurrent();
    } catch (err) {
      console.error("Error saving attendance:", err);
      setMessage({ type: "error", text: "Failed to save attendance." });
    }
  }

  return (
    <>
      <CardLayout style="cardLayout1 generalCard cardGapLarge">
        <SectionHeader icon={CalendarDotsIcon} title="Attendance Activity" />

        {currentActivity ? (
          <CardLayout style="cardLayout1 cardGapLarge">
            <div className="attendanceTypeHeader">
              {currentActivity?.attendance_type?.name === "Office" ? (
                <BuildingOfficeIcon size={30} />
              ) : currentActivity?.attendance_type?.name === "Site Visit" ? (
                <FactoryIcon size={30} />
              ) : currentActivity?.attendance_type?.name ===
                "Work From Home" ? (
                <HouseIcon size={30} />
              ) : (
                <BuildingOfficeIcon size={30} />
              )}
              <h4>{currentActivity?.attendance_type?.name}</h4>
            </div>
            <h1>{currentActivity?.clocked_in_time}</h1>
            <h4 className="textRegular textL">
              {currentActivity?.clocked_in_date}
            </h4>
            <p className="textLight textXXS">
              Click the Fingerprint to Clock Out & Change Activity
            </p>
          </CardLayout>
        ) : (
          <CardLayout style="cardLayout1 cardGapLarge">
            {currentActivity?.attendance_type?.name === "Office" ? (
              <h4>
                <BuildingOfficeIcon size={30} /> In Office
              </h4>
            ) : null}
            <h2>Welcome back!</h2>
            <p className="textLight textXXS">
              Click the Fingerprint to Clock In
            </p>
          </CardLayout>
        )}

        {/* ATTENDANCE ACTIVITY BUTTON */}
        {/* {currentActivity ? (
          <Button
            style="button buttonType2Clockout textBold textXXS"
            icon={ClockUserIcon}
            name="Clock Out"
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
            name="Clock In"
            onClick={() => {
              setSelectedAttendanceActivity({});
              setAttendanceSidebarOpen(true);
              setCreatingAttendanceActivity(true);
            }}
          />
        )} */}

        {/* BUTTON V2 */}
        <CardLayout style="cardLayoutFlexFull">
          {currentActivity ? (
            <Button
              style="button buttonTypeClockout textBold textXXS"
              icon={FingerprintSimpleIcon}
              size={70}
              onClick={async () => {
                if (!currentActivity?.id) return;
                console.log("Current:", currentActivity);
                await clockOutAttendanceActivity(currentActivity.id);
                await refetchCurrent();
              }}
            />
          ) : (
            <Button
              style="button buttonTypeClockin textBold textXXS"
              icon={FingerprintSimpleIcon}
              size={70}
              onClick={() => {
                setSelectedAttendanceActivity({});
                setAttendanceSidebarOpen(true);
                setCreatingAttendanceActivity(true);
              }}
            />
          )}
        </CardLayout>

        {/* {currentActivity ? (
          <CardLayout key={currentActivity.id} style="cardLayout3">
            <CardLayout style="cardLayout1 generalCard">
              <p className="textBold textXXS">
                {currentActivity.attendance_type?.name} <ClockUserIcon />
              </p>
              <p className="textLight textXXS">
                {currentActivity.clocked_in_at}
              </p>
            </CardLayout>

            <CardLayout style="cardLayout1 generalCard">
              <p className="textBold textXXS">
                Clock Out
                <SignOutIcon />
              </p>
              <p className="textLight textXXS">
                {currentActivity.clocked_out_at}
              </p>
            </CardLayout>
          </CardLayout>
        ) : null} */}
      </CardLayout>

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
            ></DataSidebar>
          ))}
      </AnimatePresence>
    </>
  );
}
