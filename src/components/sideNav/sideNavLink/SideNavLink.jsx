// src/components/sideNav/sideNavLink/SideNavLink.jsx
import "./SideNavLink.scss";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDownIcon } from "@phosphor-icons/react";
import { useUnreadNotificationCount } from "../../../features/notifications/private/hooks/useUnreadNotificationCount";

export default function SideNavLink({ segment, navIsOpen, onClick }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const linkRefs = useRef([]);
  const basePath = "/app";
  const location = useLocation();
  const { unreadCount } = useUnreadNotificationCount();

  // Kept in scope before the `!segment` guard below (hooks must run
  // unconditionally) so expandedPaths' lazy initializer can read it.
  const links = segment?.links || [];

  function isPathActive(pathSuffix) {
    const to = `${basePath}/${pathSuffix}`;
    return location.pathname === to || location.pathname.startsWith(to + "/");
  }

  // Sidenav sub-links ("hide/show" page tabs) start expanded for whichever
  // link the user is already on, so landing on/deep-linking to a tab never
  // hides the group it belongs to. Plain in-memory state, not localStorage --
  // matches hoveredIndex/tooltipPos above, and this auto-expand-on-route
  // effect already covers the actual need without a persistence layer.
  const [expandedPaths, setExpandedPaths] = useState(() => {
    const initial = new Set();
    links.forEach((link) => {
      if (link.tabs?.length && isPathActive(link.path)) initial.add(link.path);
    });
    return initial;
  });

  useEffect(() => {
    const activeParent = links.find(
      (link) => link.tabs?.length && isPathActive(link.path),
    );
    if (activeParent) {
      setExpandedPaths((prev) =>
        prev.has(activeParent.path)
          ? prev
          : new Set(prev).add(activeParent.path),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function toggleExpanded(path, e) {
    e.preventDefault();
    e.stopPropagation();
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  useEffect(() => {
    if (hoveredIndex !== null && linkRefs.current[hoveredIndex]) {
      const rect = linkRefs.current[hoveredIndex].getBoundingClientRect();
      setTooltipPos({
        top: rect.top + rect.height / 5,
        left: rect.right,
      });
    }
  }, [hoveredIndex]);

  if (!segment) return null;

  const { segmentTitle, segmentCode } = segment;

  return (
    <div className="sideNavLinkSegment">
      {navIsOpen && segmentTitle && (
        <p className="textBold textS">{segmentTitle}</p>
      )}

      {!navIsOpen && segmentCode && (
        <p className="textBold segmentCode">{segmentCode}</p>
      )}

      {links.map((link, index) => {
        const Icon = link.icon;
        const to = `${basePath}/${link.path}`;
        const isActive =
          location.pathname === to || location.pathname.startsWith(to + "/");
        const hasTabs =
          navIsOpen && Array.isArray(link.tabs) && link.tabs.length > 0;
        const isExpanded = hasTabs && expandedPaths.has(link.path);

        return (
          <div
            key={link.path || index}
            className="sideNavLinkWrapper"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={onClick}
          >
            <div className={`sideNavLinkRow ${!navIsOpen ? "isClosed" : ""}`}>
              <Link
                to={to}
                className={`sideNavLink textXXXS ${
                  isActive ? "active" : ""
                } ${!navIsOpen ? "isClosed" : ""}`}
                ref={(el) => (linkRefs.current[index] = el)}
              >
                {link.path === "notifications" && unreadCount > 0 ? (
                  <span className="sideNavIconWrapper">
                    <Icon size="20" weight={isActive ? "fill" : "regular"} />
                    <span className="sideNavUnreadBadge textXXXS">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  </span>
                ) : (
                  <Icon size="20" weight={isActive ? "fill" : "regular"} />
                )}
                {navIsOpen ? link.label : null}

                {hasTabs && (
                  <button
                    type="button"
                    className={`sideNavExpandToggle ${
                      isExpanded ? "expanded" : ""
                    }`}
                    onClick={(e) => toggleExpanded(link.path, e)}
                    aria-label={
                      isExpanded
                        ? `Collapse ${link.label}`
                        : `Expand ${link.label}`
                    }
                  >
                    <CaretDownIcon size={14} />
                  </button>
                )}
              </Link>
            </div>

            {hasTabs && (
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    className="sideNavSubLinks"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    {link.tabs.map((tab) => {
                      const TabIcon = tab.icon;
                      const tabTo = `${to}/${tab.path}`;
                      const tabActive =
                        location.pathname === tabTo ||
                        location.pathname.startsWith(tabTo + "/");

                      return (
                        <Link
                          key={tab.path}
                          to={tabTo}
                          className={`sideNavSubLink textXXXS ${
                            tabActive ? "active" : ""
                          }`}
                          onClick={onClick}
                        >
                          <TabIcon
                            size="16"
                            weight={tabActive ? "fill" : "regular"}
                          />
                          {tab.label}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Tooltip rendered outside the sidenav via portal */}
            {createPortal(
              <AnimatePresence>
                {!navIsOpen && hoveredIndex === index && (
                  <motion.div
                    className="sideNavTooltip textXS"
                    style={{
                      position: "fixed",
                      top: tooltipPos.top,
                      left: tooltipPos.left,
                    }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {Array.isArray(link.tabs) && link.tabs.length > 0 ? (
                      <div className="sideNavTooltipWithTabs">
                        <Link to={to} className="sideNavTooltipTitle">
                          {link.label}
                        </Link>
                        {link.tabs.map((tab) => (
                          <Link
                            key={tab.path}
                            to={`${to}/${tab.path}`}
                            className="sideNavTooltipTabLink"
                          >
                            {tab.label}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      link.label
                    )}
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}
          </div>
        );
      })}
    </div>
  );
}
