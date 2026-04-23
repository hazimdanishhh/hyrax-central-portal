import { useState } from "react";
import "./Reports.scss";
import { motion } from "framer-motion";
import { CircleNotchIcon } from "@phosphor-icons/react";

function Reports() {
  const [loading, setLoading] = useState(true);

  return (
    <div style={{ position: "relative" }}>
      {loading && (
        <div className="loadingIcon">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              repeat: Infinity,
              ease: "linear",
              duration: 1,
            }}
            className="loadingIcon"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
            }}
          >
            <CircleNotchIcon size={40} />
          </motion.div>
        </div>
      )}

      <iframe
        // src="https://lookerstudio.google.com/embed/reporting/f5f4024e-508c-4791-b488-7204073b7f37/page/wpajF" // Old Looker Studio
        src="https://datastudio.google.com/embed/reporting/2ec1f106-fc4c-46b9-a0b3-76afd7ec768a/page/ffgvF"
        allowFullScreen
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="salesReportAnalytics"
        onLoad={() => setLoading(false)}
        loading="async"
      ></iframe>
    </div>
  );
}

export default Reports;
