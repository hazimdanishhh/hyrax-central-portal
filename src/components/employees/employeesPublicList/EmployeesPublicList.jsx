import { CaretCircleRightIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import "./EmployeesPublicList.scss";
import CardLayout from "../../cardLayout/CardLayout";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import AttendanceType from "../../attendance/attendanceType/AttendanceType";
import AttendanceClock from "../../attendance/attendanceClock/AttendanceClock";

export default function EmployeesPublicList({
  className,
  onClick,
  employee,
  isMyManager,
}) {
  console.log(
    "name:",
    employee.full_name,
    "current_status",
    employee.current_status,
  );
  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="employeeListHeaderContainer">
        <div className="employeeListHeader">
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
        </div>
        <div className="employeeCardStatusContainer">
          <AttendanceType attendanceType={employee.current_status} />
          {employee.first_arrival_time && (
            <AttendanceClock
              time={employee.first_arrival_time}
              type="clockin"
            />
          )}
          {employee.last_status_time && (
            <AttendanceClock time={employee.last_status_time} type="clockout" />
          )}
          {/* <button className="listArrow">
            <CaretCircleRightIcon size={28} weight="light" />
          </button> */}
        </div>
      </div>
    </motion.div>
  );
}
