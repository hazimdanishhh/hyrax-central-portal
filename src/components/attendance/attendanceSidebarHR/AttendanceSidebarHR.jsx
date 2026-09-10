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

          {/* Show the Daily Macro Flag */}
          <StatusBox
            status={selectedRow?.hr_flag}
            type={`${selectedRow?.hr_flag?.startsWith("On Leave") ? "purple" : selectedRow?.hr_flag === "Review Required" ? "yellow" : selectedRow?.hr_flag === "Approved" || selectedRow?.hr_flag === "OK" ? "green" : "red"}`}
          />
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
