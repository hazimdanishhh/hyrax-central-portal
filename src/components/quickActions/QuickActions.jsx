import "./QuickActions.scss";
import { CaretDown, CaretUp, Megaphone, Plus, Sparkle } from "phosphor-react";
import { Link } from "react-router";
import QuickActionsCard from "./quickActionsCard/QuickActionsCard";
import { useTheme } from "../../context/ThemeContext";
import { quickActionsHome } from "../../data/quickActionsCardData";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useMediaQuery from "../../functions/mediaQuery";

function QuickActions() {
  const { darkMode, toggleMode } = useTheme();
  const [quickActionsIsOpen, setQuickActionsIsOpen] = useState(true);

  const isDesktop = useMediaQuery("(min-width: 1025px)");

  useEffect(() => {
    if (!isDesktop) {
      setQuickActionsIsOpen(false);
    } else {
      setQuickActionsIsOpen(true);
    }
  }, [isDesktop]);

  return (
    <div className="quickActionsSection">
      <button
        className="quickActionsHeader"
        onClick={() => setQuickActionsIsOpen(!quickActionsIsOpen)}
      >
        <Sparkle size="16" weight="bold" />
        <p className="textBold textXXS">Quick Actions</p>
        {quickActionsIsOpen ? (
          <CaretUp size="18" weight="bold" />
        ) : (
          <CaretDown size="18" weight="bold" />
        )}
      </button>

      <AnimatePresence mode="wait">
        {quickActionsIsOpen && (
          <motion.div
            className="quickActionsCardLayout"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {quickActionsHome.map((action, index) => (
              <QuickActionsCard
                key={index}
                icon={action.icon}
                name={action.name}
                path={action.path}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default QuickActions;
