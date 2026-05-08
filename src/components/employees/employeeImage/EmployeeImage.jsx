import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { Link } from "react-router";
import "./EmployeeImage.scss";

function EmployeeImage({
  showName,
  setShowName,
  employee,
  position = "right",
  employeeId,
}) {
  return (
    <Link
      className="employeeLinkWrapper"
      onClick={(e) => e.stopPropagation()}
      to={`/app/employees/${employeeId || employee.employee_id}`}
      onMouseEnter={() => setShowName(true)}
      onMouseLeave={() => setShowName(false)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="listEmployeePhoto">
        <img
          src={
            employee.avatar_url
              ? `${employee.avatar_url}`
              : "/profilePhoto/default.webp"
          }
          alt={employee.employee_name || employee.full_name}
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
            {employee.employee_name || employee.full_name}
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
  );
}

export default EmployeeImage;
