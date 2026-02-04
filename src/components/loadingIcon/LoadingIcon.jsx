import { motion } from "framer-motion";
import "./LoadingIcon.scss";
import { CircleNotch } from "phosphor-react";

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
        <CircleNotch size={40} />
      </motion.div>
    </div>
  );
}

export default LoadingIcon;
