import "./MobileNav.scss";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowsClockwiseIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useTheme } from "../../context/ThemeContext";
import SideNavLink from "../sideNav/sideNavLink/SideNavLink";
import LogoutButton from "../buttons/logoutButton/LogoutButton";
import ThemeButton from "../buttons/themeButton/ThemeButton";
import Button from "../buttons/button/Button";
import ClockinMini from "../attendanceActivityClockin/clockinMini/ClockinMini";
import { useProfile } from "../../context/ProfileContext";
import { useAuth } from "../../context/AuthContext";
import { useAccessControl } from "../../context/AccessControlContext";

// Phone menu drawer (≤768px). Opened and closed by BottomTabBar's Menu
// button; AppLayout owns the open state and also closes it on navigation.
// Since the Navbar is hidden on phones (2026-10-22), this drawer carries
// what the Navbar used to: the profile (photo, name, last login -> profile
// page) and Refresh, which an installed PWA has no browser button for.
export default function MobileNav({ onClose, mobileNavIsOpen }) {
  const { darkMode } = useTheme();
  const { navigation } = useAccessControl();
  const { profile } = useProfile();
  const { session } = useAuth();
  const lastSignInAt = session?.user?.last_sign_in_at;

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
      id="mobileNav"
      className={`mobileNav ${darkMode ? "sectionDark" : "sectionLight"} ${
        !mobileNavIsOpen ? "close" : ""
      }`}
      // Closed, it is only slid off-screen: `inert` keeps its links out of
      // the tab order and away from screen readers until it opens.
      inert={!mobileNavIsOpen}
      transition={{
        duration: 0.1,
      }}
      style={{
        WebkitBackfaceVisibility: "hidden",
        WebkitTransform: "translateZ(0)", // prevents Safari flicker
        backfaceVisibility: "hidden",
      }}
    >
      {/* HEADER */}
      <div className="sideNavSegment">
        <Link to="/app/profile" className="mobileNavProfile" onClick={onClose}>
          <img src={profile?.avatar_url} alt="" />
          <span className="mobileNavProfileText">
            <span className="textBold textXS textOverflow">
              {profile?.full_name}
            </span>
            <span className="textLight textXXXS">
              Last login:{" "}
              {lastSignInAt
                ? new Date(lastSignInAt).toLocaleString("en-MY", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Never"}
            </span>
          </span>
          <CaretRightIcon size={18} className="mobileNavProfileArrow" />
        </Link>

        <ClockinMini navIsOpen />

        {/* NAV SEGMENTS */}
        {navigation.map((segment, index) => (
          <div key={index}>
            <div className="sideNavLinkLayout">
              <SideNavLink segment={segment} navIsOpen onClick={onClose} />
            </div>
            <hr className="sideNavLinkHr" />
          </div>
        ))}
      </div>

      <div className="mobileNavButtons">
        <Button
          name="Refresh"
          icon2={ArrowsClockwiseIcon}
          size={18}
          style="button buttonType2"
          onClick={() => window.location.reload()}
        />
        <ThemeButton name style="button buttonType2" />
        <LogoutButton navIsOpen style="button buttonType4 rejection" />
      </div>
    </motion.div>
  );
}
