// functions/usePageTransition.js
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function usePageTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();

  const triggerTransition = (targetPath) => {
    setIsTransitioning(true);
    setTimeout(() => {
      navigate(targetPath);
    }, 1000); // Match the animation duration
  };

  return { isTransitioning, triggerTransition };
}
