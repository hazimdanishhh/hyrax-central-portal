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
import { useMessage } from "../../context/MessageContext";
import { useAttendance } from "../../context/AttendanceProvider";
import useAttendanceActivities from "../../hooks/useAttendanceActivities";

export default function AttendanceActivityClockin() {
  const { darkMode, toggleMode } = useTheme();
  const { showMessage } = useMessage;
  const [period, setPeriod] = useState("year"); // "year" | "month"

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
  const {
    attendanceActivities,
    loading: loadingAttendanceActivities,
    error: errorAttendanceActivities,
  } = useAttendanceActivities();

  // GET WORKING DAYS BASED ON THE PERIOD (MONTH OR YEAR)
  function getWorkingDays(period) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let start;

    if (period === "year") {
      start = new Date(year, 0, 1);
    } else {
      start = new Date(year, month, 1);
    }

    const end = now;

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const day = current.getDay();
      const isWeekend = day === 0 || day === 6;

      if (!isWeekend) count++;

      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  const workingDays = getWorkingDays(period);

  // FILTER ATTENDANCE BASED ON PERIOD
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const filteredActivities = attendanceActivities.filter((a) => {
    const activityDate = new Date(a.clocked_in_at);

    if (period === "year") {
      return activityDate.getFullYear() === currentYear;
    }

    if (period === "month") {
      return (
        activityDate.getFullYear() === currentYear &&
        activityDate.getMonth() === currentMonth
      );
    }

    return false;
  });

  // ACTIVE DAYS CALCULATION
  const attendanceDaysSet = new Set(
    filteredActivities.map((a) => new Date(a.clocked_in_at).toDateString()),
  );

  const attendedDays = attendanceDaysSet.size;

  // INACTIVE DAYS CALCULATION
  const inactiveDays = workingDays - attendedDays;

  const attendanceRate =
    workingDays > 0 ? Math.round((attendedDays / workingDays) * 100) : 0;

  // OVERVIEW

  const totalAttendance = attendanceActivities.length;

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
      <CardLayout style="cardLayout1 generalCard">
        <SectionHeader icon={CalendarDotsIcon} title="Attendance Activity" />

        <CardLayout style="cardLayout2">
          <CardLayout style="cardLayout1 generalCard">
            {currentActivity ? (
              <CardLayout style="cardLayout1 cardGapLarge">
                <div className="attendanceTypeHeader">
                  {currentActivity?.attendance_type?.name === "Office" ? (
                    <BuildingOfficeIcon size={30} />
                  ) : currentActivity?.attendance_type?.name ===
                    "Site Visit" ? (
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
            <CardLayout style="cardLayoutFlexFull cardLayoutNoPadding">
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
          </CardLayout>

          <CardLayout style="cardLayout1">
            {/* PERIOD BUTTON */}
            <CardLayout style="cardLayoutFlex cardLayoutNoPadding cardGapLarge">
              <Button
                style={
                  period === "year"
                    ? "button buttonType2 active"
                    : "button buttonType2"
                }
                name="This Year"
                onClick={() => setPeriod("year")}
              />

              <Button
                style={
                  period === "month"
                    ? "button buttonType2 active"
                    : "button buttonType2"
                }
                name="This Month"
                onClick={() => setPeriod("month")}
              />
            </CardLayout>

            {/* OVERVIEW */}
            <CardLayout style="cardLayout1">
              <CardLayout style="generalCard greenCard">
                <h3 className="textRegular textS">Active Days</h3>
                <h2 className="textXL">{attendedDays}</h2>
              </CardLayout>

              <CardLayout style="generalCard redCard">
                <h3 className="textRegular textS">Inactive Days</h3>
                <h2 className="textXL">{inactiveDays}</h2>
              </CardLayout>

              <CardLayout style="generalCard">
                <h3 className="textRegular textS">Working Days</h3>
                <h2 className="textXL">{workingDays}</h2>
              </CardLayout>

              <CardLayout
                style={
                  attendanceRate >= 90
                    ? "generalCard greenCard"
                    : attendanceRate >= 70
                      ? "generalCard yellowCard"
                      : "generalCard redCard"
                }
              >
                <h3 className="textRegular textS">Attendance Rate</h3>
                <h2 className="textXL">{attendanceRate}%</h2>
              </CardLayout>
            </CardLayout>
          </CardLayout>
        </CardLayout>
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
