import { SignInIcon, SignOutIcon } from "@phosphor-icons/react";
import React, { useState } from "react";
import "./AttendanceCard.scss";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import { AnimatePresence, motion } from "framer-motion";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import CardLayout from "../../cardLayout/CardLayout";
import AttendanceType from "../attendanceType/AttendanceType";
import AttendanceClock from "../attendanceClock/AttendanceClock";

// GENERAL REUSABLE ATTENDANCE CARD
// WITH PHOTO, ATTENDANCE TYPE ICONS, CLOCK IN/OUT AND APPROVAL STATUS
function AttendanceCard({ activity, onClick }) {
  const [showName, setShowName] = useState(false);

  return (
    <button
      className="generalCard cardPaddingSmall attendanceCard"
      onClick={onClick}
    >
      <div className="attendanceCardNameHeader">
        <EmployeeImage
          showName={showName}
          setShowName={setShowName}
          employee={activity}
        />
        <p className="textBold textXS" title={activity.employee_name}>
          {activity.employee_preferred_name}
        </p>
        <AttendanceType attendanceType={activity.attendance_type_name} />
      </div>
      <div className="attendanceCardSegment">
        <div className="attendanceCardClockWrapper">
          <AttendanceClock time={activity.clocked_in_time} type="clockin" />

          {activity.clocked_out_at && (
            <AttendanceClock time={activity.clocked_out_time} type="clockout" />
          )}
        </div>

        <StatusBadge status={activity.approval_status} />
      </div>
    </button>
  );
}

export default AttendanceCard;
