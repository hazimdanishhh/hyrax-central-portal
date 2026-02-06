import {
  CaretCircleRight,
  Envelope,
  IdentificationBadge,
  Phone,
  UsersThree,
} from "phosphor-react";
import { motion } from "framer-motion";
import "./EmployeeCard.scss";
import CardLayout from "../cardLayout/CardLayout";
import EmployeeStatus from "../status/employeeStatus/EmployeeStatus";
import Button from "../buttons/button/Button";

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
        <EmployeeStatus status={employment_status_name} />
        <button className="employeeCardArrow">
          <CaretCircleRight size={28} weight="light" />
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
            <IdentificationBadge />
            {employee_id}
          </p>
          <p className="textLight textXXS">
            <Phone /> {phone_work}
          </p>
        </CardLayout>
        <p className="textLight textXXS">
          <Envelope /> {email_work}
        </p>
      </div>
    </motion.div>
  );
}

export default EmployeeCard;
