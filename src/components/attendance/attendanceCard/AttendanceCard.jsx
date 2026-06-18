import { SignInIcon, SignOutIcon } from "@phosphor-icons/react";
import React, { useState } from "react";
import "./AttendanceCard.scss";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import { AnimatePresence, motion } from "framer-motion";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import CardLayout from "../../cardLayout/CardLayout";
import AttendanceType from "../attendanceType/AttendanceType";
import AttendanceClock from "../attendanceClock/AttendanceClock";
import StatusBox from "../../status/statusBox/StatusBox";

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
        <p className="textBold textXS" title={activity.full_name}>
          {activity.full_name}
        </p>
        {activity.daily_activities && (
          <AttendanceType attendanceType={activity.daily_activities} />
        )}
      </div>
      <div className="attendanceCardSegment">
        <div className="attendanceCardClockWrapper">
          {activity.first_in_time && (
            <AttendanceClock time={activity.first_in_time} type="clockin" />
          )}
          {activity.last_out_time && (
            <AttendanceClock time={activity.last_out_time} type="clockout" />
          )}
        </div>

        <StatusBox
          status={activity.hr_flag}
          type={
            activity.hr_flag === "Review Required"
              ? "yellow"
              : activity.hr_flag === "Approved" || activity.hr_flag === "OK"
                ? "green"
                : "red"
          }
        />
      </div>
    </button>
  );
}

export default AttendanceCard;
