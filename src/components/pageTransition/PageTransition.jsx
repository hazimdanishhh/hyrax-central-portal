// components/pageTransition/PageTransition.jsx
import { motion, AnimatePresence } from "framer-motion";
import PropTypes from "prop-types";
import "./PageTransition.scss";

export default function PageTransition({ isVisible, mode = "enter" }) {
  const variants = {
    enter: {
      initial: { scale: 0, opacity: 1 },
      animate: { scale: 10, opacity: 1 },
      exit: { scale: 10, opacity: 0 },
    },
    exit: {
      initial: { scale: 10, opacity: 1 },
      animate: { scale: 0, opacity: 1 },
      exit: { scale: 0, opacity: 0 },
    },
  };

  const selected = variants[mode];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="transition-circle"
          initial={selected.initial}
          animate={selected.animate}
          exit={selected.exit}
          transition={{
            duration: 0.8,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      )}
    </AnimatePresence>
  );
}

PageTransition.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(["enter", "exit"]),
};
