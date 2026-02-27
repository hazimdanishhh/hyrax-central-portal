import "./SideNav.scss";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDotsIcon,
  ClockUserIcon,
  SidebarSimpleIcon,
  SignInIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { navModalVariant } from "../../functions/motionUtils";
import { useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { sideNavLinkData } from "../../data/sideNavLinkData";
import SideNavLink from "./sideNavLink/SideNavLink";
import ThemeButton from "../buttons/themeButton/ThemeButton";
import useMediaQuery from "../../functions/mediaQuery";
import LogoutButton from "../buttons/logoutButton/LogoutButton";
import useUserProfile from "../../hooks/useUserProfile";
import Button from "../buttons/button/Button";
import DataSidebar from "../dataSidebar/DataSidebar";
import useAttendanceTypes from "../../hooks/useAttendanceTypes";
import { attendanceActivityConfig } from "../../data/attendanceActivityConfig";
import LoadingIcon from "../loadingIcon/LoadingIcon";
import useAttendanceActivityMutations from "../../hooks/useAttendanceActivityMutations";
import useEmployee from "../../hooks/useEmployee";
import SectionHeader from "../sectionHeader/SectionHeader";
import CardLayout from "../cardLayout/CardLayout";
import useCurrentAttendanceActivity from "../../hooks/useCurrentAttendanceActivity";

export default function SideNav() {
  const [navIsOpen, setNavIsOpen] = useState(true);
  const { darkMode, toggleMode } = useTheme();
  const navModalRef = useRef(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const isDesktop = useMediaQuery("(min-width: 1025px)");
  const [selectedAttendanceActivity, setSelectedAttendanceActivity] =
    useState(null);
  const [attendanceSidebarOpen, setAttendanceSidebarOpen] = useState(false);
  const [selectedAttendanceType, setSelectedAttendanceType] = useState(null);
  const [creatingAttendanceActivity, setCreatingAttendanceActivity] =
    useState(false);

  // Fetch Data
  const { profile, loading: profileLoading } = useUserProfile();
  const { employee, loading: employeeLoading } = useEmployee();
  const { attendanceTypes, loading: attendanceTypesLoading } =
    useAttendanceTypes();

  const { currentActivity, refetchCurrent } = useCurrentAttendanceActivity(
    employee?.id,
  );

  // Determine user’s accessible navigation
  const userRole = profile?.role?.toLowerCase() || "staff";
  const userDepartment = profile?.departmentSub || "GEN";

  // Fallbacks
  const userNavSegments =
    userRole === "superadmin"
      ? sideNavLinkData.superadmin
      : sideNavLinkData[userDepartment] || sideNavLinkData.GEN;

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
      <motion.div
        className={`sideNav ${darkMode ? "sectionDark" : "sectionLight"} ${
          !navIsOpen ? "close" : ""
        }`}
        variants={navModalVariant}
        ref={navModalRef}
      >
        {/* HEADER */}
        <div className="sideNavSegment">
          {/* DARK MODE + OPEN CLOSE SIDENAV */}
          <div
            className={`sideNavLogoContainer ${!navIsOpen ? "isClosed" : ""} ${
              darkMode ? "sectionDark" : "sectionLight"
            }`}
          >
            {navIsOpen && <ThemeButton style="iconButton" />}
            <button
              onClick={() => setNavIsOpen(!navIsOpen)}
              className="navButtonType1"
            >
              <SidebarSimpleIcon size="24" />
            </button>
          </div>

          {/* ATTENDANCE ACTIVITY BUTTON */}
          {navIsOpen &&
            (currentActivity ? (
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
            ))}

          {currentActivity && navIsOpen ? (
            <CardLayout key={currentActivity.id} style="cardLayout1">
              <CardLayout style="cardLayout1 generalCard">
                <p>
                  {currentActivity.attendance_type?.name} <ClockUserIcon />
                </p>
                <p>{currentActivity.clocked_in_at}</p>
              </CardLayout>

              <CardLayout style="cardLayout1 generalCard">
                <p>
                  Clock Out
                  <SignOutIcon />
                </p>
                <p>{currentActivity.clocked_out_at}</p>
              </CardLayout>
            </CardLayout>
          ) : null}

          {/* NAV SEGMENTS */}
          {userNavSegments.map((segment, index) => (
            <div key={index}>
              <div className="sideNavLinkLayout">
                <SideNavLink
                  segment={segment}
                  navIsOpen={navIsOpen}
                  role={userRole}
                />
              </div>
              <hr className="sideNavLinkHr" />
            </div>
          ))}
        </div>

        <div className="sideNavButtons">
          <LogoutButton
            setMessage={setMessage}
            navIsOpen={navIsOpen}
            style="button buttonType2"
          />
        </div>
      </motion.div>

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
