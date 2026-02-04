import "./SideNav.scss";
import { motion } from "framer-motion";
import { SidebarSimple } from "phosphor-react";
import { navModalVariant } from "../../functions/motionUtils";
import { useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { sideNavLinkData } from "../../data/sideNavLinkData";
import SideNavLink from "./sideNavLink/SideNavLink";
import ThemeButton from "../buttons/themeButton/ThemeButton";
import useMediaQuery from "../../functions/mediaQuery";
import LogoutButton from "../buttons/logoutButton/LogoutButton";
import useUserProfile from "../../hooks/useUserProfile";

export default function SideNav() {
  const [navIsOpen, setNavIsOpen] = useState(true);
  const { darkMode, toggleMode } = useTheme();
  const navModalRef = useRef(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const isDesktop = useMediaQuery("(min-width: 1025px)");

  // Fetch User Profile Data
  const { profile, loading } = useUserProfile();

  // Determine user’s accessible navigation
  const userRole = profile?.role?.toLowerCase() || "staff";
  const userDepartment = profile?.departmentSub || "GEN";

  // Fallbacks
  const userNavSegments =
    userRole === "superadmin"
      ? sideNavLinkData.superadmin
      : sideNavLinkData[userDepartment] || sideNavLinkData.GEN;

  return (
    <motion.div
      className={`sideNav ${darkMode ? "sectionDark" : "sectionLight"} ${
        !navIsOpen ? "close" : ""
      }`}
      variants={navModalVariant}
      ref={navModalRef}
    >
      {/* HEADER */}
      <div className="sideNavSegment">
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
            <SidebarSimple size="24" />
          </button>
        </div>

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
  );
}
