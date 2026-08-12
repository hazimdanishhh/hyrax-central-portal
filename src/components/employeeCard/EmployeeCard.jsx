import {
  CaretCircleRightIcon,
  EnvelopeIcon,
  IdentificationBadgeIcon,
  PhoneIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import "./EmployeeCard.scss";
import CardLayout from "../cardLayout/CardLayout";
import StatusBadge from "../status/statusBadge/StatusBadge";
import AttendanceType from "../attendance/attendanceType/AttendanceType";

function EmployeeCard({ className, onClick, employee, isMyManager }) {
  return (
    <motion.div
      className={className}
      onClick={onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="employeeCardStatusContainer">
        <StatusBadge status={employee.employment_status_name} />
        <AttendanceType attendanceType={employee.current_status} />
        <button className="employeeCardArrow">
          <CaretCircleRightIcon size={28} weight="light" />
        </button>
      </div>

      <div className="employeeCardHeaderContainer">
        <div className="employeeCardPhoto">
          <img
            src={employee.avatar_url || "/profilePhoto/default.webp"}
            alt={employee.full_name}
          />
        </div>

        <div className="employeeCardHeaderDetails">
          <p className="textBold textS">{employee.full_name}</p>
          <p className="textRegular textXXS">{employee.department_name}</p>
          <p className="textLight textXXXS">{employee.position}</p>
          {isMyManager && (
            <p className="managerBadge textXXXS">Reporting Manager</p>
          )}
        </div>
      </div>

      <div className="employeeCardDetails">
        <CardLayout style="cardLayout2">
          <p className="textLight textXXS">
            <IdentificationBadgeIcon />
            {employee.employee_id}
          </p>
          <p className="textLight textXXS">
            <PhoneIcon /> {employee.phone_work}
          </p>
          <p className="textLight textXXS">
            <EnvelopeIcon /> {employee.email_work}
          </p>
        </CardLayout>
      </div>
    </motion.div>
  );
}

export default EmployeeCard;
