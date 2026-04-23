// components/MessageUI.jsx
import { motion, AnimatePresence } from "framer-motion";
import "./MessageUI.scss";
import {
  CheckIcon,
  CircleNotchIcon,
  InfoIcon,
  WarningDiamondIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect } from "react";
import { useMessage } from "../../context/MessageContext";

// Animation variants
const variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function MessageUI({ timeout = 3000 }) {
  const { message, clearMessage } = useMessage();

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => clearMessage(), timeout);
    return () => clearTimeout(timer);
  }, [message, clearMessage, timeout]);

  if (!message) return null;

  const { type, text } = message;

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          key={text}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={variants}
          className={`messageUI ${
            type === "error"
              ? "error"
              : type === "success"
                ? "success"
                : type === "info"
                  ? "info"
                  : "loading"
          }`}
          onClick={() => clearMessage()}
        >
          {type === "loading" && (
            <div className="loadingIcon">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, ease: "linear", duration: 1 }}
                className="loadingIcon"
              >
                <CircleNotchIcon />
              </motion.div>
            </div>
          )}
          {type === "error" && <XIcon />}
          {type === "success" && <CheckIcon />}
          {type === "info" && <InfoIcon />}
          {type === "warning" && <WarningDiamondIcon />}
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
