import { CaretCircleRightIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import "./EmployeesPublicList.scss";
import CardLayout from "../../cardLayout/CardLayout";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import AttendanceType from "../../attendance/attendanceType/AttendanceType";

export default function EmployeesPublicList({
  className,
  onClick,
  employee,
  isMyManager,
}) {
  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="employeeCardHeaderContainer">
        <div className="employeeCardPhoto">
          <img
            src={employee.avatar_url || "/profilePhoto/default.webp"}
            alt={employee.full_name}
          />
        </div>

        <div className="employeeCardHeaderDetails">
          <p className="textBold textXXS">{employee.full_name}</p>
          <p className="textRegular textXXXS employeeListMobile">
            {employee.department_name}
          </p>
          <p className="textLight textXXXS employeeListMobile">
            {employee.position}
          </p>
          {isMyManager && (
            <p className="managerBadge textXXXS">Reporting Manager</p>
          )}
        </div>
        <div className="employeeCardStatusContainer">
          {employee.current_attendance_type_name && (
            <AttendanceType
              attendanceType={employee.current_attendance_type_name}
            />
          )}
          <StatusBadge status={employee.employment_status_name} />
          <button className="listArrow">
            <CaretCircleRightIcon size={28} weight="light" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
