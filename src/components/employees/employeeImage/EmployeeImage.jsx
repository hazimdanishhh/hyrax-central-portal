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
  displayName,
}) {
  console.log(employee);

  return (
    <Link
      className="employeeLinkWrapper"
      onClick={(e) => e.stopPropagation()}
      to={`/app/employees/${employeeId || employee.employee_id || employee.id}`}
      onMouseEnter={() => setShowName(true)}
      onMouseLeave={() => setShowName(false)}
      target="_blank"
      rel="noopener noreferrer"
      style={
        displayName && {
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flex: "1 1 200px",
        }
      }
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

      {displayName && (
        <p className="textRegular textXS" style={{ textAlign: "start" }}>
          {employee.employee_name || employee.full_name}
        </p>
      )}
    </Link>
  );
}

export default EmployeeImage;
