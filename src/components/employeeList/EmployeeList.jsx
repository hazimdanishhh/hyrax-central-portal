import {
  CaretCircleRight,
  Envelope,
  IdentificationBadge,
  Phone,
  UsersThree,
} from "phosphor-react";
import { motion } from "framer-motion";
import "./EmployeeList.scss";
import CardLayout from "../cardLayout/CardLayout";
import StatusBadge from "../status/statusBadge/StatusBadge";

export default function EmployeeList({
  className,
  onClick,
  src,
  full_name,
  position,
  employee_id,
  department_name,
  email_work,
  phone_work,
  isMyManager,
  employment_status_name,
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
          <img src={src || "/profilePhoto/default.webp"} alt={full_name} />
        </div>

        <div className="employeeCardHeaderDetails">
          <p className="textBold textXXS">{full_name}</p>
          <p className="textRegular textXXXS">{department_name}</p>
          <p className="textLight textXXXS">{position}</p>
          {isMyManager && (
            <p className="managerBadge textXXXS">Reporting Manager</p>
          )}
        </div>
        <div className="employeeCardStatusContainer">
          <StatusBadge status={employment_status_name} />
          <button className="listArrow">
            <CaretCircleRight size={28} weight="light" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
