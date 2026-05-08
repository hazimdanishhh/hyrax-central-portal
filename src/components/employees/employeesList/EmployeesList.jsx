import { CaretCircleRightIcon, NotePencilIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import CardLayout from "../../cardLayout/CardLayout";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import AttendanceType from "../../attendance/attendanceType/AttendanceType";

export default function EmployeesList({ employee, onClick, saving, deleting }) {
  return (
    <motion.div
      className="employeeList generalCard"
      onClick={saving ? null : deleting ? null : onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="employeeCardHeaderContainer">
        <div className="employeeCardPhoto">
          <img
            src={employee.profile?.avatar_url || "/profilePhoto/default.webp"}
            alt={employee.full_name}
          />
        </div>

        <div className="employeeCardHeaderDetails">
          <p className="textBold textXXS">{employee.full_name}</p>
          <p className="textRegular textXXXS">{employee.department?.name}</p>
          <p className="textLight textXXXS">{employee.position}</p>
        </div>
        <div className="employeeCardStatusContainer">
          <StatusBadge status={employee.employment_status?.name} />
          <button className="listArrow iconButton2">
            <NotePencilIcon size={16} weight="light" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
