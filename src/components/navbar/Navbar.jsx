import "./Navbar.scss";
import { Link } from "react-router";
import { useRef, useState } from "react";
import logo from "/src/assets/favicon.svg";
import {
  ArrowsClockwiseIcon,
  BellIcon,
  CaretRightIcon,
  SidebarSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import useClickOutside from "../../hooks/useClickOutside";
import { useTheme } from "../../context/ThemeContext";
import NotificationCard from "../notifications/notificationCard/NotificationCard";
import MobileNav from "../mobileNav/MobileNav";
import useMediaQuery from "../../functions/mediaQuery";
import { useAuth } from "../../context/AuthContext";
import Button from "../buttons/button/Button";
import { useProfile } from "../../context/ProfileContext";
import { formatRelativeTime } from "../../functions/formatDate";
import { useRecentNotifications } from "../../features/notifications/private/hooks/useRecentNotifications";
import { useUnreadNotificationCount } from "../../features/notifications/private/hooks/useUnreadNotificationCount";
import useNotificationMutations from "../../features/notifications/private/hooks/useNotificationMutations";

function Navbar() {
  const [mobileNavIsOpen, setMobileNavIsOpen] = useState(false);
  const { darkMode } = useTheme();
  const navModalRef = useRef(null);
  const [notificationIsOpen, setNotificationIsOpen] = useState(false);
  const notificationRef = useRef();
  useClickOutside(notificationRef, () => setNotificationIsOpen(false));
  const isDesktop = useMediaQuery("(min-width: 1025px)");
  const { notifications } = useRecentNotifications(4);
  const { unreadCount } = useUnreadNotificationCount();
  const { markRead } = useNotificationMutations();

  // Fetch User Session
  const { session } = useAuth();
  const last_sign_in_at = session?.user?.last_sign_in_at;

  // Fetch User Profile
  const { profile } = useProfile();

  // Close navbar when clicked outside
  useClickOutside(navModalRef, () => setMobileNavIsOpen(false));

  return (
    <>
      <nav className={darkMode ? "navbar sectionDark" : "navbar sectionLight"}>
        {/* LOGO & HEADER */}
        <div className="navbarSegment navbarLogoContainer">
          <button
            onClick={() => setMobileNavIsOpen(!mobileNavIsOpen)}
            className="navButtonType1 mobileNavIcon"
          >
            <SidebarSimpleIcon size="24" />
          </button>

          <Link to="/app" className="textRegular textXS navbarLogo">
            <img src={logo} alt="Logo" style={{ width: "40px" }} />
            Hyrax Portal
          </Link>
        </div>

        {/* NAVBAR BUTTONS */}
        <div className="navbarSegment">
          {/* USER PROFILE */}
          <div className="textOverflow navbarProfile">
            <p className="textRegular textXS">{profile?.full_name}</p>
            <p className="textLight textXXXS">
              <strong className="textRegular">Last Login:</strong>{" "}
              {last_sign_in_at
                ? new Date(last_sign_in_at).toLocaleString("en-MY", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Never"}
            </p>
          </div>

          {/* NOTIFICATION */}
          {isDesktop && (
            <div className="notificationSection">
              <button
                onClick={() => setNotificationIsOpen(!notificationIsOpen)}
                className="navButton"
              >
                <BellIcon size="24" />
                {unreadCount > 0 && (
                  <span className="notificationUnreadBadge textXXXS">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence mode="wait">
                {notificationIsOpen && (
                  <motion.div
                    className={
                      darkMode
                        ? "notificationWrapper sectionDark"
                        : "notificationWrapper sectionLight"
                    }
                    ref={notificationRef}
                  >
                    <div className="notificationHeader">
                      <BellIcon size="24" />
                      <p className="textS textBold">Notifications</p>
                      <div
                        className="navButton notificationCloseButton"
                        onClick={() => setNotificationIsOpen(false)}
                      >
                        <XIcon size="24" />
                      </div>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="textLight textXXS">No notifications</p>
                    ) : (
                      notifications.map((notification) => (
                        <NotificationCard
                          key={notification.id}
                          to={notification.link_to || "/app/notifications"}
                          type={notification.type}
                          title={notification.title}
                          message={notification.message}
                          created_at={formatRelativeTime(notification.created_at)}
                          onClick={() => {
                            markRead(notification.id);
                            setNotificationIsOpen(!notificationIsOpen);
                          }}
                          truncate
                        />
                      ))
                    )}

                    <Link
                      to="/app/notifications"
                      onClick={() => setNotificationIsOpen(!notificationIsOpen)}
                      className="notificationViewAllButton textXS"
                    >
                      View All
                      <CaretRightIcon size="20" />
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <Button
            icon={ArrowsClockwiseIcon}
            tooltipName="Refresh"
            onClick={() => window.location.reload()}
            style="iconButton"
          />

          {/* User Profile Icon */}
          <Link className="profilePhoto" to="/app/profile">
            <img src={profile?.avatar_url} alt={profile?.name} />
          </Link>
        </div>

        <MobileNav
          onClick={() => setMobileNavIsOpen(!mobileNavIsOpen)}
          mobileNavIsOpen={mobileNavIsOpen}
        />
      </nav>
    </>
  );
}

export default Navbar;
