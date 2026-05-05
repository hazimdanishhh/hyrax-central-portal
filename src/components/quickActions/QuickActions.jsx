import "./QuickActions.scss";
import {
  CaretDownIcon,
  CaretUpIcon,
  MegaphoneIcon,
  PlusIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { Link } from "react-router";
import QuickActionsCard from "./quickActionsCard/QuickActionsCard";
import { useTheme } from "../../context/ThemeContext";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useMediaQuery from "../../functions/mediaQuery";

function QuickActions({ quickActionsList, title }) {
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
        className="button buttonType5"
        onClick={() => setQuickActionsIsOpen(!quickActionsIsOpen)}
      >
        <SparkleIcon size="16" weight="bold" />
        <p className="textBold textXXS">{title ? title : "Quick Actions"}</p>
        {quickActionsIsOpen ? (
          <CaretUpIcon size="18" weight="bold" />
        ) : (
          <CaretDownIcon size="18" weight="bold" />
        )}
      </button>

      <AnimatePresence mode="wait">
        {quickActionsIsOpen && (
          <motion.div
            className="cardLayout5"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {quickActionsList.map((action, index) => (
              <QuickActionsCard
                key={index}
                icon={action.icon}
                name={action.name}
                path={action.path}
                image={action.image}
                target={action.target}
                rel={action.rel}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default QuickActions;
