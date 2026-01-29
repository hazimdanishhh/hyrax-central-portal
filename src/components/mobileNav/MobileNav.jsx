import "./MobileNav.scss";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { sideNavLinkData } from "../../data/sideNavLinkData";
import SideNavLink from "../sideNav/sideNavLink/SideNavLink";
import LogoutButton from "../buttons/logoutButton/LogoutButton";
import ThemeButton from "../buttons/themeButton/ThemeButton";
import useUserProfile from "../../hooks/useUserProfile";

export default function MobileNav({ onClick, mobileNavIsOpen }) {
  const [navIsOpen, setNavIsOpen] = useState(true);
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const navModalRef = useRef(null);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Fetch User Profile Data
  const { profile, loading } = useUserProfile();

  // Determine user’s accessible navigation
  const userRole = profile?.role.toLowerCase() || "staff";
  const userDepartment = profile?.departmentSub || "GEN";

  // Fallbacks
  const userNavSegments =
    userRole === "superadmin"
      ? sideNavLinkData.superadmin
      : sideNavLinkData[userDepartment] || sideNavLinkData.GEN;

  // ⛑️ Disables background scroll only on client
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    const isMobile = window.matchMedia("(max-width: 1024px)").matches;
    const shouldDisableScroll = mobileNavIsOpen && isMobile;

    if (shouldDisableScroll) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [mobileNavIsOpen]);

  return (
    <motion.div
      className={`mobileNav ${darkMode ? "sectionDark" : "sectionLight"} ${
        !mobileNavIsOpen ? "close" : ""
      }`}
      transition={{
        duration: 0.1,
      }}
      style={{
        WebkitBackfaceVisibility: "hidden",
        WebkitTransform: "translateZ(0)", // prevents Safari flicker
        backfaceVisibility: "hidden",
      }}
      ref={navModalRef}
    >
      {/* HEADER */}
      <div className="sideNavSegment">
        {/* NAV SEGMENTS */}
        {userNavSegments.map((segment, index) => (
          <div key={index}>
            <div className="sideNavLinkLayout">
              <SideNavLink
                segment={segment}
                navIsOpen={navIsOpen}
                role={userRole}
                onClick={onClick}
              />
            </div>
            <hr className="sideNavLinkHr" />
          </div>
        ))}
      </div>

      <div className="mobileNavButtons">
        <ThemeButton name style="button buttonType2" />
        <LogoutButton
          setMessage={setMessage}
          navIsOpen={navIsOpen}
          style="button buttonType2"
        />
      </div>
    </motion.div>
  );
}
