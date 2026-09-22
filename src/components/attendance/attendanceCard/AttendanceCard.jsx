import { SignInIcon, SignOutIcon } from "@phosphor-icons/react";
import React, { useState } from "react";
import { Link } from "react-router";
import "./AttendanceCard.scss";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import { AnimatePresence } from "framer-motion";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import CardLayout from "../../cardLayout/CardLayout";
import AttendanceType from "../attendanceType/AttendanceType";
import AttendanceClock from "../attendanceClock/AttendanceClock";
import StatusBox from "../../status/statusBox/StatusBox";
import AttendanceAnomalyBadges from "../attendanceAnomalyBadges/AttendanceAnomalyBadges";
import RowFlagBadge from "../../dataTable/RowFlagBadge";
import { getDisplayAttendanceFlag } from "../../../functions/attendanceFlagStatus";
import { getAttendanceReconciliationFlags } from "../../../functions/attendanceReconciliationFlags";
import { formatHours } from "../../../functions/formatDate";

// GENERAL REUSABLE ATTENDANCE CARD
// WITH PHOTO, ATTENDANCE TYPE ICONS, CLOCK IN/OUT AND APPROVAL STATUS
// `target`/`rel` are forwarded to the underlying <Link> so a caller can open
// the day in a new tab -- PayrollReconciliationSidebar deliberately does, so HR
// can check a figure without losing their place in the payroll run. Mirrors
// RouterButton's own API rather than inventing a different one.
function AttendanceCard({ activity, to, target, rel }) {
  const [showName, setShowName] = useState(false);

  // hr_flag no longer distinguishes an unworked weekend from a genuine
  // absence (both now read "Absent") -- is_weekend is the calendar-only
  // signal that tells them apart at display time. See
  // getDisplayAttendanceFlag's own comment.
  const attendanceFlagDisplay = getDisplayAttendanceFlag(
    activity.hr_flag,
    activity.is_weekend,
  );
  // Second, independent tag for a weekend actually WORKED (same pattern as
  // the is_on_leave tag below: a small fact shown alongside the main status,
  // not folded into it).
  //
  // Reads is_worked_on_weekend directly rather than inferring it from
  // `is_weekend && hr_flag !== "Absent"`. That inference assumed an unworked
  // weekend always reads "Absent", which is only true when nothing else
  // pre-empts that branch -- a Saturday the employee was on leave reads
  // "On Leave (...)", and a Saturday that's also a public holiday reads
  // "Public Holiday (...)", so both got tagged as weekend work with nobody
  // having worked. is_worked_on_weekend already carries the real-attendance
  // check (get_attendance_dashboard_rpc.sql relies on exactly that for its
  // weekend KPIs), so this now matches what those tiles count.
  const showWorkedWeekendTag = Boolean(activity.is_worked_on_weekend);

  const reconciliationFlags = getAttendanceReconciliationFlags(activity);

  const Wrapper = to ? Link : "div";
  const wrapperProps = to
    ? {
        to,
        target,
        rel,
        className: "generalCard cardPaddingSmall attendanceCard",
      }
    : { className: "generalCard cardPaddingSmall attendanceCard" };

  return (
    <Wrapper {...wrapperProps}>
      <div className="attendanceCardContent">
        <div className="attendanceCardNameHeader">
          <EmployeeImage
            showName={false}
            setShowName={() => {}}
            employee={activity}
            nestedLink={!to}
            displayName
          />

          {/* Only meaningful in Search mode, where a card's own date isn't
            implied by the page the way it is in Day mode -- harmless to
            always show. */}
          {activity.work_date && (
            <p className="textRegular textXXS textLight">
              {activity.work_date}
            </p>
          )}
          {/* Needs Reconciliation warning -- reuses DataTable's own
            RowFlagBadge (generic, not table-specific) so the HR/My/Team
            Attendance List's "Needs Reconciliation" filter has a matching
            visual signal on the card, same idea as Payroll Export's row
            flag badge. Purely informational: clicking the card already
            opens AttendanceSidebarHR, which already has the Acknowledge/
            Apply Leave/Add Activity actions for whichever flag fired. */}
          <RowFlagBadge
            items={reconciliationFlags}
            tooltipTitle="Needs Reconciliation"
          />
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "end",
            gap: "0.4rem",
          }}
        >
          <StatusBox
            status={attendanceFlagDisplay.label}
            type={attendanceFlagDisplay.type}
          />

          {/* Worked-on-a-weekend fact, independent of hr_flag -- only shown
            when the "Weekend" label above ISN'T already covering this day
            (i.e. they actually attended). */}
          {showWorkedWeekendTag && <StatusBox status="Weekend" type="grey" />}

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
            isInsufficientHalfDayHours={activity.is_insufficient_half_day_hours}
            hasLeaveFractionError={activity.has_leave_fraction_error}
            isWorkedOnHoliday={activity.is_worked_on_holiday}
            holidayHoursWorked={activity.holiday_hours_worked}
          />
        </div>
      </div>

      {/* Hours worked sits alongside the clock chips rather than in the badge
        cluster above -- AttendanceSidebarHR.jsx pairs it with
        AttendanceAnomalyBadges, but this card already renders those badges in
        its own top-right cluster, so copying that block wholesale would give
        the card two badge rows. Deliberately OUTSIDE the first_in/last_out
        gate: a day with no clock times at all still has a meaningful (0h)
        figure, and hiding it would make an absent day look like a day whose
        hours simply weren't loaded. */}
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

        <p className="textBold textXXS attendanceCardHours">
          {formatHours(activity.hours_worked)} worked
        </p>
      </div>
    </Wrapper>
  );
}

export default AttendanceCard;
