import "./Navbar.scss";
import { Link } from "react-router";
import { useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import logo from "/src/assets/favicon.svg";
import { Bell, CaretRight, SidebarSimple, X } from "phosphor-react";
import { AnimatePresence, motion } from "framer-motion";
import useClickOutside from "../../hooks/useClickOutside";
import { useTheme } from "../../context/ThemeContext";
import NotificationCard from "../notifications/notificationCard/NotificationCard";
import { notificationData } from "../../data/notificationData";
import MobileNav from "../mobileNav/MobileNav";
import useMediaQuery from "../../functions/mediaQuery";

function Navbar() {
  const [mobileNavIsOpen, setMobileNavIsOpen] = useState(false);
  const { darkMode } = useTheme();
  const navModalRef = useRef(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [notificationIsOpen, setNotificationIsOpen] = useState(false);
  const notificationRef = useRef();
  useClickOutside(notificationRef, () => setNotificationIsOpen(false));
  const isDesktop = useMediaQuery("(min-width: 1025px)");
  const notifications = [...notificationData].reverse();

  // Fetch User Profile Data
  const { session } = useAuth();
  const user = session?.user;
  const name = user?.user_metadata?.full_name || user?.email || "Unknown";
  const avatarUrl =
    user?.user_metadata?.avatar_url || "/profilePhoto/default.webp";
  const lastLoginAt = user?.last_sign_in_at;

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
            <SidebarSimple size="24" />
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
            <p className="textRegular textXS">{name}</p>
            <p className="textLight textXXXS">
              <strong className="textRegular">Last Login:</strong>{" "}
              {lastLoginAt
                ? new Date(lastLoginAt).toLocaleString("en-MY", {
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
                <Bell size="24" />
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
                      <Bell size="24" />
                      <p className="textS textBold">Notifications</p>
                      <div
                        className="navButton notificationCloseButton"
                        onClick={() => setNotificationIsOpen(false)}
                      >
                        <X size="24" />
                      </div>
                    </div>
                    {notifications.slice(0, 4).map((notification, index) => (
                      <NotificationCard
                        key={index}
                        to={notification.to}
                        type={notification.type}
                        title={notification.title}
                        message={notification.message}
                        created_at={notification.created_at}
                        onClick={() =>
                          setNotificationIsOpen(!notificationIsOpen)
                        }
                        truncate
                      />
                    ))}

                    <Link
                      to="/app/notifications"
                      onClick={() => setNotificationIsOpen(!notificationIsOpen)}
                      className="notificationViewAllButton textXS"
                    >
                      View All
                      <CaretRight size="20" />
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* User Profile Icon */}
          <Link className="profilePhoto" to="/app/profile">
            <img src={avatarUrl} alt={name} />
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
