// components/MessageUI.jsx
// Reusable "success", "error" and "info" message component
// This component enables message to be shown in UI
// Handles clearing the message after a set time

// Example Calls

// 1. With timeout prop
// <MessageUI message={message} setMessage={setMessage} timeout="6000" />

// 2. Without timeout prop
// <MessageUI message={message} setMessage={setMessage} />

// =====================================================================================

import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";
import "./MessageUI.scss";
import { Check, CircleNotch, Info, X } from "phosphor-react";
import { useClearMessage } from "../../functions/clearMessage";

// Animation
const variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function MessageUI({ message, setMessage, timeout }) {
  if (!message) return null;

  const { type, text } = message;

  useClearMessage(message, setMessage, timeout);

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
          onClick={() => setMessage(null)}
        >
          {/* ICONS */}

          {/* LOADING ICON */}
          {type === "loading" ? (
            <div className="loadingIcon">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  ease: "linear",
                  duration: 1,
                }}
                className="loadingIcon"
              >
                <CircleNotch />
              </motion.div>
            </div>
          ) : null}

          {/* ERROR ICON */}
          {type === "error" ? <X /> : null}

          {/* SUCCESS ICON */}
          {type === "success" ? <Check /> : null}

          {/* INFO ICON */}
          {type === "info" ? <Info /> : null}

          {/* MESSAGE */}
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

MessageUI.propTypes = {
  message: PropTypes.shape({
    type: PropTypes.oneOf(["success", "error", "info", "loading"]),
    text: PropTypes.string.isRequired,
  }),
};
