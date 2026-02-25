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

function EmployeeCard({
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
      <div className="employeeCardStatusContainer">
        <StatusBadge status={employment_status_name} />
        <button className="employeeCardArrow">
          <CaretCircleRightIcon size={28} weight="light" />
        </button>
      </div>

      <div className="employeeCardHeaderContainer">
        <div className="employeeCardPhoto">
          <img src={src || "/profilePhoto/default.webp"} alt={full_name} />
        </div>

        <div className="employeeCardHeaderDetails">
          <p className="textBold textS">{full_name}</p>
          <p className="textRegular textXXS">{department_name}</p>
          <p className="textLight textXXXS">{position}</p>
          {isMyManager && (
            <p className="managerBadge textXXXS">Reporting Manager</p>
          )}
        </div>
      </div>

      <div className="employeeCardDetails">
        <CardLayout style="cardLayout2">
          <p className="textLight textXXS">
            <IdentificationBadgeIcon />
            {employee_id}
          </p>
          <p className="textLight textXXS">
            <PhoneIcon /> {phone_work}
          </p>
          <p className="textLight textXXS">
            <EnvelopeIcon /> {email_work}
          </p>
        </CardLayout>
      </div>
    </motion.div>
  );
}

export default EmployeeCard;
