import React from "react";
import { useQuery } from "@tanstack/react-query";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import AttendanceType from "../attendanceType/AttendanceType";
import {
  CheckIcon,
  ClockUserIcon,
  XIcon,
  WarningCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import "./AttendanceSidebarHR.scss";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import { fetchEmployeeDayDetails } from "../../../features/hr/attendance/private/api/attendanceOverviewService";
import StatusBox from "../../status/statusBox/StatusBox";
import AttendanceClock from "../attendanceClock/AttendanceClock";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";
import AttendanceTimelineCard from "./attendanceTimelineCard/AttendanceTimelineCard";
import AttendanceDayTimelineBar from "../attendanceDayTimelineBar/AttendanceDayTimelineBar";
import AttendanceAnomalyBadges from "../attendanceAnomalyBadges/AttendanceAnomalyBadges";
import { getDisplayAttendanceFlag } from "../../../functions/attendanceFlagStatus";

export default function AttendanceSidebarHR({
  selectedRow, // This is now the Daily Summary Row
  setSelectedId,
  setModalType,
  setModalOpen,
  clockOutAttendanceActivity,
  mode = "hr", // "hr" | "self" | "manager" -- see AttendanceTimelineCard for what each mode shows
}) {
  // 1. Fetch the granular timeline for THIS employee on THIS day
  const { data: timelineData, isLoading } = useQuery({
    queryKey: [
      "attendance_activities",
      selectedRow?.employee_uuid,
      selectedRow?.work_date,
    ],
    queryFn: () =>
      fetchEmployeeDayDetails(
        selectedRow?.employee_uuid,
        selectedRow?.work_date,
      ),
    enabled: !!selectedRow?.employee_uuid && !!selectedRow?.work_date,
  });

  // hr_flag no longer distinguishes an unworked weekend from a genuine
  // absence (both now read "Absent") -- is_weekend is the calendar-only
  // signal that tells them apart at display time. See
  // getDisplayAttendanceFlag's own comment.
  const attendanceFlagDisplay = getDisplayAttendanceFlag(
    selectedRow?.hr_flag,
    selectedRow?.is_weekend,
  );
  // Second, independent tag for a weekend actually WORKED -- the
  // unworked-weekend case is already fully covered by the "Weekend" label
  // above, so this only fires when hr_flag isn't "Absent".
  const showWorkedWeekendTag =
    selectedRow?.is_weekend && selectedRow?.hr_flag !== "Absent";

  return (
    <div className="attendanceCardSidebarContainer">
      {/* HEADER: EMPLOYEE & OVERALL DAY STATUS */}
      <div className="attendanceCardSidebarHeader">
        <p className="textRegular textS">{selectedRow?.work_date}</p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            flexWrap: "wrap",
          }}
        >
          {/* HR2000 leave ledger integration -- shown independently of
              hr_flag so a mixed day (half-day leave + half-day worked, where
              hr_flag reads "OK") still visibly surfaces the leave fact. */}
          {selectedRow?.is_on_leave && (
            <AttendanceType
              attendanceType={`On Leave (${selectedRow.leave_type_codes})`}
            />
          )}

          {/* Show the Daily Macro Flag -- getDisplayAttendanceFlag wraps the
              single shared mapping every other hr_flag consumer already uses
              (AttendanceCard.jsx, TodayAttendanceCard.jsx); this used to be
              its own hand-duplicated ternary that only recognized
              On Leave/Review Required/Approved/OK, silently defaulting
              everything else -- including Weekend/Rest Day, Absent, and
              Public Holiday -- to "red", as if they were errors. */}
          <StatusBox
            status={attendanceFlagDisplay.label}
            type={attendanceFlagDisplay.type}
          />

          {/* Worked-on-a-weekend fact, independent of hr_flag -- only shown
              when the "Weekend" label above ISN'T already covering this day
              (i.e. they actually attended). */}
          {showWorkedWeekendTag && (
            <StatusBox status="Weekend" type="grey" />
          )}
        </div>
      </div>

      <div className="attendanceCardSidebarHeader">
        <EmployeeImage
          employee={selectedRow}
          displayName={true}
          showName={false}
          setShowName={() => {}}
        />
      </div>

      <AttendanceDayTimelineBar timelineData={timelineData || []} />

      <div
        style={{
          display: "flex",
          alignItems: "start",
          justifyContent: "space-between",
          gap: "0.6rem",
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        {selectedRow.first_in_time && (
          <AttendanceClock time={selectedRow.first_in_time} type="clockin" />
        )}
        {selectedRow.last_out_time && (
          <AttendanceClock time={selectedRow.last_out_time} type="clockout" />
        )}
      </div>

      <div className="attendanceCardSidebarHeader">
        <p className="textBold textS">{selectedRow.hours_worked}h worked</p>
        <AttendanceAnomalyBadges
          overtimeHours={selectedRow.overtime_hours}
          isEarlyLeave={selectedRow.is_early_leave}
          isLateArrival={selectedRow.is_late_arrival}
          isLeaveAttendanceConflict={selectedRow.is_leave_attendance_conflict}
          isInsufficientHalfDayHours={
            selectedRow.is_insufficient_half_day_hours
          }
          hasLeaveFractionError={selectedRow.has_leave_fraction_error}
          isWorkedOnHoliday={selectedRow.is_worked_on_holiday}
          holidayHoursWorked={selectedRow.holiday_hours_worked}
        />
      </div>

      <div className="divider"></div>
      <p className="textBold textS mb-2">Activity Timeline</p>

      {/* LOADING STATE */}
      {isLoading ? (
        <LoadingIcon />
      ) : timelineData?.length === 0 ? (
        <p className="textRegular textS">
          No app activities logged for this day.
        </p>
      ) : (
        /* 2. MAP THROUGH EACH ACTIVITY IN THE DAY */
        <div className="cardLayout1 cardGapSmall cardLayoutNoPadding">
          {timelineData.map((activity) => (
            <AttendanceTimelineCard
              key={activity.activity_id}
              activity={activity}
              setModalType={setModalType}
              setModalOpen={setModalOpen}
              setSelectedId={setSelectedId}
              clockOutAttendanceActivity={clockOutAttendanceActivity}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
