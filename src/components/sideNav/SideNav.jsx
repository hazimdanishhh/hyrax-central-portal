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
import LogoutButton from "../buttons/logoutButton/LogoutButton";
import useUserProfile from "../../hooks/useUserProfile";
import useAttendanceTypes from "../../hooks/useAttendanceTypes";
import useEmployee from "../../hooks/useEmployee";
import { useAttendance } from "../../context/AttendanceProvider";
import ClockinMini from "../attendanceActivityClockin/clockinMini/ClockinMini";

export default function SideNav() {
  const [navIsOpen, setNavIsOpen] = useState(true);
  const { darkMode, toggleMode } = useTheme();
  const navModalRef = useRef(null);

  // Fetch Data
  const { profile, loading: profileLoading } = useUserProfile();
  const { employee, loading: employeeLoading } = useEmployee();
  const { attendanceTypes, loading: attendanceTypesLoading } =
    useAttendanceTypes();

  const { currentActivity, refetchCurrent } = useAttendance();

  // Determine user’s accessible navigation
  const userRole = profile?.role?.toLowerCase() || "staff";
  const userDepartment = profile?.departmentSub || "GEN";

  // Fallbacks
  const userNavSegments =
    userRole === "superadmin"
      ? sideNavLinkData.superadmin
      : sideNavLinkData[userDepartment] || sideNavLinkData.GEN;

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
          <ClockinMini navIsOpen={navIsOpen} />

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
          <LogoutButton navIsOpen={navIsOpen} style="button buttonType2" />
        </div>
      </motion.div>
    </>
  );
}
