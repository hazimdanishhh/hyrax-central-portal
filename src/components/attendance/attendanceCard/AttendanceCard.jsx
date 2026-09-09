import { SignInIcon, SignOutIcon } from "@phosphor-icons/react";
import React, { useState } from "react";
import "./AttendanceCard.scss";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import { AnimatePresence } from "framer-motion";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import CardLayout from "../../cardLayout/CardLayout";
import AttendanceType from "../attendanceType/AttendanceType";
import AttendanceClock from "../attendanceClock/AttendanceClock";
import StatusBox from "../../status/statusBox/StatusBox";
import AttendanceAnomalyBadges from "../attendanceAnomalyBadges/AttendanceAnomalyBadges";
import getHrFlagStatusType from "../../../functions/attendanceFlagStatus";

// GENERAL REUSABLE ATTENDANCE CARD
// WITH PHOTO, ATTENDANCE TYPE ICONS, CLOCK IN/OUT AND APPROVAL STATUS
function AttendanceCard({ activity, onClick }) {
  const [showName, setShowName] = useState(false);

  return (
    <button
      className="generalCard cardPaddingSmall attendanceCard"
      onClick={onClick}
    >
      <div className="attendanceCardContent">
        <div className="attendanceCardNameHeader">
          <EmployeeImage
            showName={showName}
            setShowName={setShowName}
            employee={activity}
          />
          <p className="textBold textXS" title={activity.full_name}>
            {activity.full_name}
          </p>
          {/* Only meaningful in Search mode, where a card's own date isn't
            implied by the page the way it is in Day mode -- harmless to
            always show. */}
          {activity.work_date && (
            <p className="textRegular textXXS textLight">
              {activity.work_date}
            </p>
          )}
          {activity.daily_activities && (
            <AttendanceType attendanceType={activity.daily_activities} />
          )}
          {/* HR2000 leave ledger integration -- shown independently of
            daily_activities/hr_flag so a mixed day (half-day leave + half-day
            worked, where hr_flag reads "OK") still visibly surfaces the
            leave fact, not just a pure leave day. */}
          {activity.is_on_leave && (
            <AttendanceType
              attendanceType={`On Leave (${activity.leave_type_codes})`}
            />
          )}
        </div>

        <div className="attendanceCardSegment">
          <StatusBox
            status={activity.hr_flag}
            type={getHrFlagStatusType(activity.hr_flag)}
          />

          {/* AttendanceAnomalyBadges already self-guards (renders nothing
            when none of its inputs apply) -- no outer gate needed here, and
            gating on overtime_hours specifically would hide every other
            badge (leave conflict, early leave, etc.) on a day with no
            overtime. */}
          <AttendanceAnomalyBadges
            overtimeHours={activity.overtime_hours}
            isEarlyLeave={activity.is_early_leave}
            isLateArrival={activity.is_late_arrival}
            isLeaveAttendanceConflict={activity.is_leave_attendance_conflict}
            isInsufficientHalfDayHours={
              activity.is_insufficient_half_day_hours
            }
            hasLeaveFractionError={activity.has_leave_fraction_error}
          />
        </div>
      </div>

      {(activity.last_out_time || activity.first_in_time) && (
        <div className="attendanceCardClockWrapper">
          {activity.first_in_time && (
            <AttendanceClock
              time={activity.first_in_time}
              type="clockin"
              isAnomaly={activity.is_late_arrival}
            />
          )}
          {activity.last_out_time && (
            <AttendanceClock
              time={activity.last_out_time}
              type="clockout"
              isAnomaly={activity.is_early_leave}
            />
          )}
        </div>
      )}
    </button>
  );
}

export default AttendanceCard;
