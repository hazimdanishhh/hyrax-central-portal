// components/tooltip/Tooltip.jsx

import { cloneElement, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/context/ThemeContext";
import "./Tooltip.scss";

/**
 * Generic hover tooltip -- wraps a single child element, shows a small
 * floating box with arbitrary `content` on hover. No generic (non-Recharts)
 * tooltip existed in this codebase before this: CustomTooltip.jsx is driven
 * by Recharts' own `payload` props, and SideNavLink.jsx has its own one-off
 * inline tooltip (same createPortal technique reused here, but never
 * extracted for reuse). Portal-rendered to document.body so it's never
 * clipped by a scrolling/overflow-hidden ancestor (e.g. a sidebar panel).
 *
 * The ref/hover handlers are attached directly to the child via
 * cloneElement, rather than an extra wrapper div, so the child stays a
 * true direct sibling in whatever layout context it's placed in (e.g. a
 * flex row of proportionally-sized segments) and getBoundingClientRect()
 * measures its actual rendered box.
 */
export default function Tooltip({ content, children }) {
  const { darkMode } = useTheme();
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  function handleMouseEnter(event) {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.top, left: rect.left + rect.width / 2 });
    }
    setVisible(true);
    children.props.onMouseEnter?.(event);
  }

  function handleMouseLeave(event) {
    setVisible(false);
    children.props.onMouseLeave?.(event);
  }

  return (
    <>
      {cloneElement(children, {
        ref,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      })}
      {visible &&
        content &&
        createPortal(
          <div
            className={`tooltipPopover ${darkMode ? "sectionDark" : "sectionLight"}`}
            style={{
              top: pos.top,
              left: pos.left,
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
