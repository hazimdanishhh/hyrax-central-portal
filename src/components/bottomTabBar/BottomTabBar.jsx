import "./BottomTabBar.scss";
import { Link, useLocation } from "react-router-dom";
import { ListIcon } from "@phosphor-icons/react";
import { useTheme } from "../../context/ThemeContext";
import { bottomTabLinks } from "../../data/sideNavLinkData";
import { isNavActive, navTo } from "../../functions/navPaths";
import { useUnreadNotificationCount } from "../../features/notifications/private/hooks/useUnreadNotificationCount";
import BottomTabClockIn from "./BottomTabClockIn";

// Phone-only primary navigation (≤768px, where SideNav and the Navbar are
// hidden). The everyday links from bottomTabLinks, plus a Menu button that
// opens MobileNav for everything else (department pages, profile, theme,
// logout). Sits above the iOS home indicator via safe-area insets, so it
// works as an installed PWA.
//
// Active state comes from functions/navPaths.js, the same rule SideNav uses,
// not from NavLink's own matching: NavLink treats "/app" as a prefix of every
// page, which is why Home used to be lit everywhere. While the menu is open,
// only Menu is lit.
export default function BottomTabBar({ menuOpen, onMenuToggle }) {
  const { darkMode } = useTheme();
  const { pathname } = useLocation();
  const { unreadCount } = useUnreadNotificationCount();

  return (
    <nav
      className={`bottomTabBar ${darkMode ? "sectionDark" : "sectionLight"}`}
      aria-label="Primary"
    >
      {bottomTabLinks.map((link) => {
        if (link.action === "clockIn") {
          return <BottomTabClockIn key="clockIn" />;
        }

        const Icon = link.icon;
        const isActive =
          !menuOpen && isNavActive(pathname, link.match ?? link.path);
        const badge =
          link.showUnreadBadge && unreadCount > 0
            ? unreadCount > 9
              ? "9+"
              : String(unreadCount)
            : null;

        return (
          <Link
            key={link.path}
            to={navTo(link.path)}
            className={`bottomTabLink textXXXS ${isActive ? "active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            aria-label={badge ? `${link.label}, ${badge} unread` : undefined}
          >
            <span className="bottomTabIcon">
              <Icon size={24} weight={isActive ? "fill" : "regular"} />
              {badge && (
                <span className="bottomTabBadge textXXXS" aria-hidden="true">
                  {badge}
                </span>
              )}
            </span>
            <span
              className={`textXXXS ${isActive ? "textBold" : "textRegular"}`}
            >
              {link.label}
            </span>
          </Link>
        );
      })}

      <button
        type="button"
        className={`bottomTabLink textXXXS ${menuOpen ? "active" : ""}`}
        onClick={onMenuToggle}
        aria-expanded={menuOpen}
        aria-controls="mobileNav"
      >
        <span className="bottomTabIcon">
          <ListIcon size={24} weight={menuOpen ? "bold" : "regular"} />
        </span>
        <span className={`textXXXS ${menuOpen ? "textBold" : "textRegular"}`}>
          Menu
        </span>
      </button>
    </nav>
  );
}
