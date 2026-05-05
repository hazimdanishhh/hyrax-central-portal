import { SignInIcon, SignOutIcon } from "@phosphor-icons/react";
import React, { useState } from "react";
import "./AttendanceCard.scss";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import { AnimatePresence, motion } from "framer-motion";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import CardLayout from "../../cardLayout/CardLayout";

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
          table={activity}
        />
        <p className="textBold textXS" title={activity.employee_name}>
          {activity.employee_preferred_name}
        </p>
        <p className="textRegular textXS">{activity.attendance_type_name}</p>
      </div>
      <div className="attendanceCardSegment">
        <div className="attendanceCardClockWrapper">
          <div className="attendanceCardClock green">
            <p className="textBold textXXS">{activity.clocked_in_time}</p>
            <div className="attendanceCardIcon">
              <SignInIcon weight="bold" size={12} />
            </div>
          </div>

          {activity.clocked_out_at && (
            <div className="attendanceCardClock yellow">
              <p className="textBold textXXS">{activity.clocked_out_time}</p>
              <div className="attendanceCardIcon">
                <SignOutIcon weight="bold" size={12} />
              </div>
            </div>
          )}
        </div>

        <StatusBadge status={activity.approval_status} />
      </div>
    </button>
  );
}

export default AttendanceCard;
