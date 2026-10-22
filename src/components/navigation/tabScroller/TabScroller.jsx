// src/components/navigation/tabScroller/TabScroller.jsx

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import "./TabScroller.scss";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The shared page-tab strip (2026-10-22). Wrap a page's tab links in it
 * instead of a bare `<div className="pageTabContainer">`:
 *
 *   <TabScroller ariaLabel="Leads sections">
 *     <NavLink ... className={({ isActive }) => `button buttonTypeTab ${isActive ? "active" : ""}`}>
 *   </TabScroller>
 *
 * What it adds to the plain scrolling strip:
 *   * the ACTIVE tab is brought into view (centred) on load and whenever it
 *     changes -- by route (NavLink) or by state (PageTab, a toggle). It looks
 *     for the child with the `active` class, the convention every tab strip
 *     here already uses, and watches for that class moving, so no prop is
 *     needed;
 *   * ‹ › buttons, shown only while the tabs overflow, each disabled at its
 *     end (kept in place rather than hidden, so the strip never jumps under
 *     the pointer);
 *   * faded edges on whichever side has more tabs out of view;
 *   * smooth scrolling, except for the first positioning and for anyone who
 *     has asked their system for reduced motion.
 *
 * The inner element keeps the `pageTabContainer` class, so every page's tab
 * styling (styles/index.scss) applies unchanged.
 */
export default function TabScroller({ children, ariaLabel = "Page sections", className = "" }) {
  const scrollRef = useRef(null);
  const positionedRef = useRef(false);
  const activeRef = useRef(null);
  const [state, setState] = useState({ overflow: false, left: false, right: false });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    const next = {
      overflow,
      left: overflow && el.scrollLeft > 1,
      right: overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    };
    setState((prev) =>
      prev.overflow === next.overflow && prev.left === next.left && prev.right === next.right
        ? prev
        : next,
    );
  }, []);

  // Centre the active tab inside the strip (never scrolls the page itself).
  const revealActive = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector(":scope > .active");
    activeRef.current = active;
    if (!active || el.scrollWidth <= el.clientWidth + 1) return;

    const strip = el.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    const offset = tab.left + tab.width / 2 - (strip.left + strip.width / 2);
    const smooth = positionedRef.current && !prefersReducedMotion();
    el.scrollTo({ left: el.scrollLeft + offset, behavior: smooth ? "smooth" : "auto" });
    positionedRef.current = true;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    measure();
    revealActive();

    el.addEventListener("scroll", measure, { passive: true });

    // Strip or tabs resized (window, sidenav toggle, fonts loading).
    const resize = new ResizeObserver(() => {
      measure();
      if (!positionedRef.current) revealActive();
    });
    resize.observe(el);
    Array.from(el.children).forEach((child) => resize.observe(child));

    // The active tab changed: a route change re-renders NavLink's class, a
    // state toggle re-renders a Button's -- either way a `class` changes.
    // Changes to the strip's OWN class (its fade edges, which follow the
    // scroll position) are ignored, and the strip only re-centres when a
    // DIFFERENT tab becomes active -- otherwise every manual scroll or arrow
    // click would snap straight back to the active tab.
    const mutation = new MutationObserver((records) => {
      if (records.every((r) => r.target === el && r.type === "attributes")) return;
      measure();
      const active = el.querySelector(":scope > .active");
      if (active !== activeRef.current) revealActive();
    });
    mutation.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

    return () => {
      el.removeEventListener("scroll", measure);
      resize.disconnect();
      mutation.disconnect();
    };
  }, [measure, revealActive]);

  function page(direction) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * el.clientWidth * 0.75,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  const fade = [state.left && "fadeLeft", state.right && "fadeRight"].filter(Boolean).join(" ");

  return (
    <nav className={`tabScroller ${className}`} aria-label={ariaLabel}>
      {state.overflow && (
        <button
          type="button"
          className="tabScrollerArrow"
          onClick={() => page(-1)}
          disabled={!state.left}
          aria-label="Scroll tabs left"
          tabIndex={-1}
        >
          <CaretLeftIcon size={16} weight="bold" />
        </button>
      )}

      <div ref={scrollRef} className={`pageTabContainer ${fade}`}>
        {children}
      </div>

      {state.overflow && (
        <button
          type="button"
          className="tabScrollerArrow"
          onClick={() => page(1)}
          disabled={!state.right}
          aria-label="Scroll tabs right"
          tabIndex={-1}
        >
          <CaretRightIcon size={16} weight="bold" />
        </button>
      )}
    </nav>
  );
}
