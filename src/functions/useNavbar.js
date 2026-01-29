import { useState, useEffect, useRef } from "react";

export default function useNavbar() {
  const [activePopup, setActivePopup] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [initialX, setInitialX] = useState(0);
  const navOverlayRef = useRef(null);
  const prevIsMobileView = useRef(false);

  // ⛑️ Safely check media query on mount only (browser only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      prevIsMobileView.current = window.matchMedia(
        "(max-width: 1024px)"
      ).matches;
    }
  }, []);

  const openOverlay = (popupName) => {
    setActivePopup(popupName);
  };

  const closeOverlay = () => {
    setActivePopup(null);
  };

  const toggleMenu = () => {
    setIsActive(!isActive);
  };

  // ⛑️ Disables background scroll only on client
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    const isMobile = window.matchMedia("(max-width: 1024px)").matches;
    const shouldDisableScroll = (activePopup || isActive) && isMobile;

    if (shouldDisableScroll) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [activePopup, isActive]);

  // ⛑️ Listen for resize only in browser
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const isMobileView = window.matchMedia("(max-width: 1024px)").matches;

      if (isMobileView !== prevIsMobileView.current) {
        setActivePopup(null);
        setIsActive(false);
      }

      prevIsMobileView.current = isMobileView;
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // ⛑️ Close overlay when clicking outside (only in browser)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleClickOutside = (event) => {
      if (
        navOverlayRef.current &&
        !navOverlayRef.current.contains(event.target)
      ) {
        closeOverlay();
      }
    };

    if (activePopup) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activePopup]);

  // ⛑️ Track screen size for animation
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateInitialX = () => {
      setInitialX(window.innerWidth <= 1024 ? 500 : 0);
    };

    updateInitialX();
    window.addEventListener("resize", updateInitialX);

    return () => {
      window.removeEventListener("resize", updateInitialX);
    };
  }, []);

  return {
    activePopup,
    isActive,
    initialX,
    navOverlayRef,
    openOverlay,
    closeOverlay,
    toggleMenu,
  };
}
