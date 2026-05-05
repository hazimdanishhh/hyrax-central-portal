import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { Link } from "react-router";
import "./EmployeeImage.scss";

function EmployeeImage({ showName, setShowName, table, position = "right" }) {
  return (
    <Link
      className="employeeLinkWrapper"
      to={`/app/employees/${table.employee_id}`}
      onMouseEnter={() => setShowName(true)}
      onMouseLeave={() => setShowName(false)}
    >
      <div className="listEmployeePhoto">
        <img
          src={
            table.avatar_url
              ? `${table.avatar_url}`
              : "/profilePhoto/default.webp"
          }
          alt={table.employee_name}
        />
      </div>
      <AnimatePresence mode="wait">
        {showName && (
          <motion.div
            className={
              position === "right"
                ? "textRegular textXXXS listEmployeePhotoNameRight"
                : "textRegular textXXXS listEmployeePhotoName"
            }
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            {table.employee_name}
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
  );
}

export default EmployeeImage;
