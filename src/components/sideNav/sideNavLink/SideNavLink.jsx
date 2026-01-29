// src/components/sideNav/sideNavLink/SideNavLink.jsx
import "./SideNavLink.scss";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export default function SideNavLink({ segment, navIsOpen, role, onClick }) {
  if (!segment) return null;

  const { segmentTitle, segmentCode, links } = segment;
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const linkRefs = useRef([]);
  const basePath = "/app";
  const location = useLocation();

  useEffect(() => {
    if (hoveredIndex !== null && linkRefs.current[hoveredIndex]) {
      const rect = linkRefs.current[hoveredIndex].getBoundingClientRect();
      setTooltipPos({
        top: rect.top + rect.height / 5,
        left: rect.right,
      });
    }
  }, [hoveredIndex]);

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
        const isActive = location.pathname === to;

        return (
          <div
            key={link.path || index}
            className="sideNavLinkWrapper"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={onClick}
          >
            <Link
              to={to}
              className={`sideNavLink textXXS ${isActive ? "active" : ""} ${
                !navIsOpen ? "isClosed" : ""
              }`}
              ref={(el) => (linkRefs.current[index] = el)}
            >
              <Icon size="20" weight={isActive ? "fill" : "regular"} />
              {navIsOpen ? link.label : null}
            </Link>

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
                  >
                    {link.label}
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
