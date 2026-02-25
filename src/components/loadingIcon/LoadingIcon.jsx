import { motion } from "framer-motion";
import "./LoadingIcon.scss";
import { CircleNotchIcon } from "@phosphor-icons/react";

function LoadingIcon() {
  return (
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
        <CircleNotchIcon size={40} />
      </motion.div>
    </div>
  );
}

export default LoadingIcon;
