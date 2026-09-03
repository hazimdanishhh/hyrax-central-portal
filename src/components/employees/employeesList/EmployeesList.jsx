import {
  CaretCircleRightIcon,
  CircleIcon,
  NotePencilIcon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import CardLayout from "../../cardLayout/CardLayout";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import StatusBox from "../../status/statusBox/StatusBox";
import AttendanceType from "../../attendance/attendanceType/AttendanceType";
import Button from "../../buttons/button/Button";
import {
  CASE_TYPE_LABEL,
  CASE_TYPE_BADGE_TYPE,
} from "../../../features/employeeLifecycle/private/lifecycleCaseStatusMeta";

export default function EmployeesList({
  employee,
  onClick,
  saving,
  deleting,
  setIsEditing,
  selected,
  onSelect,
}) {
  return (
    <motion.div
      className="employeeList generalCard"
      onClick={saving ? null : deleting ? null : onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="employeeListHeaderContainer">
        {/* <Button
          style={`iconButton ${selected ? "active" : ""}`}
          size={12}
          icon={CircleIcon}
          weight="fill"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        /> */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <div className="employeeCardPhoto">
            <img
              src={employee.profile?.avatar_url || "/profilePhoto/default.webp"}
              alt={employee.full_name}
            />
          </div>

          <div className="employeeCardHeaderDetails">
            <p className="textBold textXXS">{employee.full_name}</p>
            <p className="textRegular textXXXS employeeListMobile">
              {employee.department?.name}
            </p>
            <p className="textLight textXXXS employeeListMobile">
              {employee.position}
            </p>
          </div>
        </div>
        <div className="employeeCardStatusContainer">
          <StatusBadge status={employee.employment_status?.name} />
          {/* Lifecycle case badges -- this is the DEFAULT view
              (EmployeeManagement.jsx's layout=2), so this is where the
              onboarding/offboarding gap actually needs to close, not just
              in the table-layout toggle. See
              docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md. */}
          {(employee.lifecycle_cases ?? []).map((c) => (
            <StatusBox
              key={c.id}
              status={CASE_TYPE_LABEL[c.case_type]}
              type={CASE_TYPE_BADGE_TYPE[c.case_type]}
            />
          ))}
          <button
            className="listArrow iconButton2 employeeListMobile"
            onClick={setIsEditing}
          >
            <NotePencilIcon size={16} weight="light" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
