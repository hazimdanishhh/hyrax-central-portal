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
import StackedBarRenderer from "../../chartCard/StackedBarRenderer";
import AttendanceTimelineCard from "./attendanceTimelineCard/AttendanceTimelineCard";

export default function AttendanceSidebarHR({
  selectedRow, // This is now the Daily Summary Row
  setSelectedId,
  setModalType,
  setModalOpen,
  clockOutAttendanceActivity,
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

  console.log("Timeline Data", timelineData);

  const workDayData = [
    {
      name: "Worked",
      value: selectedRow.hours_worked,
    },
    {
      name: "Remaining",
      value: Math.max(0, 8 - selectedRow.hours_worked).toFixed(2),
    },
  ];

  return (
    <div className="attendanceCardSidebarContainer">
      {/* HEADER: EMPLOYEE & OVERALL DAY STATUS */}
      <div className="attendanceCardSidebarHeader">
        <div>
          <EmployeeImage employee={selectedRow} />
          <p className="textBold textM">{selectedRow?.full_name}</p>
          <p className="textRegular textS">{selectedRow?.work_date}</p>
        </div>
        {/* Show the Daily Macro Flag */}
        <StatusBox
          status={selectedRow?.hr_flag}
          type={`${selectedRow?.hr_flag === "Review Required" ? "yellow" : selectedRow?.hr_flag === "Approved" || selectedRow?.hr_flag === "OK" ? "green" : "red"}`}
        />
      </div>

      <StackedBarRenderer
        data={workDayData}
        colorMap={{
          Worked: "#22c55e",
          Remaining: "#a1a1a1",
        }}
        height={30}
      />

      <p className="textBold textS">{selectedRow.hours_worked}h worked</p>

      <div className="attendanceCardClockWrapper">
        {selectedRow.first_in_time && (
          <AttendanceClock time={selectedRow.first_in_time} type="clockin" />
        )}
        {selectedRow.last_out_time && (
          <AttendanceClock time={selectedRow.last_out_time} type="clockout" />
        )}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
