import {
  CaretDownIcon,
  CaretUpIcon,
  CheckIcon,
  ClockUserIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAttendanceActivitiesMetadata } from "../../../../features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import useAttendanceActivityMutations from "../../../../features/hr/attendance/private/hooks/useAttendanceActivityMutations";
import useAttendanceLogScans from "../../../../features/hr/attendance/private/hooks/useAttendanceLogScans";
import { attendanceActivitiesChangeClockInTimeConfig } from "../../../../pages/user/hr/attendanceManagement/list/changeClockInTimeConfig";
import { attendanceActivitiesChangeClockOutTimeConfig } from "../../../../pages/user/hr/attendanceManagement/list/changeClockOutTimeConfig";
import Button from "../../../buttons/button/Button";
import LoadingIcon from "../../../loadingIcon/LoadingIcon";
import StackedBarRenderer from "../../../chartCard/StackedBarRenderer";
import DataForm from "../../../crud/dataForm/DataForm";
import StatusBadge from "../../../status/statusBadge/StatusBadge";
import StatusBox from "../../../status/statusBox/StatusBox";
import AttendanceType from "../../attendanceType/AttendanceType";
import { attendanceActivityTableConfig } from "./tableConfig";
import AttendanceClock from "../../attendanceClock/AttendanceClock";
import "./AttendanceTimelineCard.scss";

export default function AttendanceTimelineCard({
  activity,
  setModalType,
  setModalOpen,
  setSelectedId,
  clockOutAttendanceActivity,
  mode = "hr", // "hr" (HR Attendance Management, full access) | "self" (My
  // Attendance -- view + self clock-out only) | "manager" (Team Attendance
  // -- view + approve/reject direct reports only, no edit)
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState("none"); // "none" | "edit" | "clockIn" | "clockOut"

  // Scan-log verification -- unconditional across every mode (hr/self/
  // manager/readonly), purely read-only, so it isn't gated like the action
  // buttons below. Lazy-fetched only once expanded.
  const [scansExpanded, setScansExpanded] = useState(false);
  const { scans, isLoading: scansLoading } = useAttendanceLogScans({
    employeeCode: activity.company_employee_code,
    scannerLocation: activity.attendance_type,
    workDate: activity.work_date,
    enabled: scansExpanded,
  });

  // ==============
  // METADATA
  // ==============
  const { employees, attendanceTypes } = useAttendanceActivitiesMetadata();

  // ==============
  // MUTATIONS HOOK
  // ==============
  const {
    updateAttendanceActivity: updateRow,
    deleteAttendanceActivity: deleteRow,
    saving,
    deleting,
  } = useAttendanceActivityMutations();

  const columns = attendanceActivityTableConfig({
    employees,
    attendanceTypes,
  });

  //   CLOCK IN / OUT COLUMNS
  const clockInColumns = attendanceActivitiesChangeClockInTimeConfig();
  const clockOutColumns = attendanceActivitiesChangeClockOutTimeConfig();

  // ==============
  // LEAVE (HR2000 ledger) -- a leave day has no punch times/approval
  // workflow/edit actions, so it gets its own simple render instead of
  // falling through to the App/Hardware JSX below (which would otherwise
  // show a misleading "0h worked / 8h remaining" bar and null clock chips).
  // ==============
  if (activity.event_source === "Leave") {
    const hasConflict =
      activity.is_leave_attendance_conflict ||
      activity.is_insufficient_half_day_hours ||
      activity.has_leave_fraction_error;

    return (
      <div className="generalCard cardPaddingSmall cardGapSmall">
        <div className="attendanceCardSidebarHeader">
          <AttendanceType attendanceType={activity.attendance_type} />
          <StatusBox status={`${activity.day_fraction} Day`} type="purple" />
        </div>
        {activity.remarks && (
          <p className="textRegular textXS textLight">{activity.remarks}</p>
        )}
        {/* HR2000 leave/attendance conflict detection -- day-level facts
          reused from unified_daily_attendance (joined onto every audit row
          by employee_uuid + work_date), shown only here since the Leave row
          is what a reviewer would actually open to act on. */}
        {hasConflict && (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {activity.is_leave_attendance_conflict && (
              <StatusBox status="Attendance Conflict" type="red" />
            )}
            {activity.is_insufficient_half_day_hours && (
              <StatusBox status="Insufficient Hours" type="red" />
            )}
            {activity.has_leave_fraction_error && (
              <StatusBox status="Fraction Error" type="red" />
            )}
          </div>
        )}
      </div>
    );
  }

  // ==============
  // PUBLIC HOLIDAY -- same reasoning as Leave above: no punch times,
  // approval workflow, or edit actions apply to a holiday, so it gets its
  // own simple render instead of falling through to the App/Hardware JSX
  // below.
  // ==============
  if (activity.event_source === "Holiday") {
    return (
      <div className="generalCard cardPaddingSmall cardGapSmall">
        <div className="attendanceCardSidebarHeader">
          <AttendanceType attendanceType={activity.attendance_type} />
        </div>
        {/* Reconciliation fact, joined from unified_daily_attendance --
          real attendance on a day nobody was expected to work. */}
        {activity.is_worked_on_holiday && (
          <StatusBox
            status={`Worked ${Number(activity.holiday_hours_worked).toFixed(1)}h on this holiday`}
            type="blue"
          />
        )}
      </div>
    );
  }

  // ==============
  // SAVE + UPDATE
  // ==============
  async function handleRequestSave(data) {
    await updateRow(data);

    await queryClient.invalidateQueries({
      queryKey: ["attendance_activities"],
    });

    setIsEditing("none");
  }

  // ==============
  // DELETE
  // ==============
  async function handleRequestDelete(data) {
    await deleteRow(data.activity_id);

    await queryClient.invalidateQueries({
      queryKey: ["attendance_activities"],
    });

    setIsEditing("none");
  }

  return (
    <div
      key={activity.activity_id}
      className="generalCard cardPaddingSmall cardGapSmall"
    >
      {/* ACTIVITY HEADER: Type & Status */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <AttendanceType attendanceType={activity.attendance_type} />
        <StatusBadge status={activity.approval_status} />
      </div>

      {/* TEST VISUAL BAR */}
      <StackedBarRenderer
        data={[
          {
            name: "Worked",
            value:
              activity.check_in_time && activity.check_out_time // CHANGED HERE
                ? Number(
                    (
                      (new Date(activity.check_out_time) - // CHANGED HERE
                        new Date(activity.check_in_time)) / // CHANGED HERE
                      1000 /
                      60 /
                      60
                    ).toFixed(2),
                  )
                : 0,
          },
          {
            name: "Remaining",
            value:
              activity.check_in_time && activity.check_out_time // CHANGED HERE
                ? Math.max(
                    0,
                    8 -
                      (new Date(activity.check_out_time) - // CHANGED HERE
                        new Date(activity.check_in_time)) / // CHANGED HERE
                        1000 /
                        60 /
                        60,
                  ).toFixed(2)
                : 8,
          },
        ]}
        colorMap={{
          Worked: "#22c55e",
          Remaining: "#a1a1a1",
        }}
        height={30}
        noLegend
      />

      {/* TIMING TABLE */}
      <div className="attendanceCardSidebarHeader">
        <div
          style={{
            display: "flex",
            gap: "0.4rem",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {/* <p className="textBold textXXS mb-1">{activity.event_source} Data</p> */}

          <AttendanceClock time={activity.check_in_time_only} type="clockin" />
          <AttendanceClock
            time={activity.check_out_time_only}
            type="clockout"
          />
        </div>
      </div>

      {/* ACTIVITY AUDIT FLAG (Micro-level warning) */}
      {activity.activity_audit_flag.includes("Valid") ? (
        <StatusBox status={activity.activity_audit_flag} type="green" />
      ) : (
        <StatusBox status={activity.activity_audit_flag} type="red" />
      )}

      {/* SCAN-LOG VERIFICATION -- Hardware rows are a summary (first scan,
          last scan, count) built from possibly several raw attendance_logs
          rows; let HR or the employee themselves verify exactly when each
          scan happened. Inline expand, not a second sidebar -- usually just
          a handful of rows. */}
      {activity.event_source === "Hardware" && (
        <>
          <Button
            onClick={() => setScansExpanded((prev) => !prev)}
            icon={scansExpanded ? CaretUpIcon : CaretDownIcon}
            style="button buttonType4 textBold textXXS"
            name={scansExpanded ? "Hide Scans" : "Verify Scans"}
          />
          {scansExpanded &&
            (scansLoading ? (
              <LoadingIcon />
            ) : scans.length === 0 ? (
              <p className="textRegular textXS textLight">
                No raw scans found.
              </p>
            ) : (
              <div className="attendanceScanLogList">
                {scans.map((scan, i) => (
                  <p
                    key={`${scan.scanned_at}-${i}`}
                    className="textRegular textXXS"
                  >
                    <span className="textBold">Scan {i + 1}:</span>{" "}
                    {scan.scanned_at_time}
                  </p>
                ))}
              </div>
            ))}
        </>
      )}

      {/* ACTION BUTTONS SPECIFIC TO THIS ACTIVITY */}
      {activity.event_source === "App" && (
        <>
          <div className="attendanceCardApprovalContainer">
            {/* CLOCK OUT (If currently active) -- HR or the employee
                themselves */}
            {(mode === "hr" || mode === "self") && !activity.check_out_time && (
              <Button
                style="button buttonType2Clockout textBold textXXS"
                icon={ClockUserIcon}
                name="Clock Out"
                onClick={async () => {
                  await clockOutAttendanceActivity(activity.activity_id);
                }}
              />
            )}

            {/* APPROVE / REJECT (If Pending) -- HR or the employee's direct
                manager, never the employee themselves */}
            {(mode === "hr" || mode === "manager") &&
              activity.approval_status === "Pending" &&
              activity.check_out_time && (
                <>
                  <Button
                    onClick={() => {
                      setSelectedId(activity.activity_id); // Target THIS specific activity
                      setModalType("approve");
                      setModalOpen(true);
                    }}
                    icon={CheckIcon}
                    style="button buttonType4 approval"
                    name="Approve"
                  />
                  <Button
                    onClick={() => {
                      setSelectedId(activity.activity_id); // Target THIS specific activity
                      setModalType("reject");
                      setModalOpen(true);
                    }}
                    icon={XIcon}
                    style="button buttonType4 rejection"
                    name="Reject"
                  />
                </>
              )}
          </div>

          {/* EDIT / EDIT CLOCK IN / EDIT CLOCK OUT -- HR only; neither the
              employee nor their manager can backdate/edit raw clock times */}
          {mode === "hr" && isEditing === "none" && (
            <>
              <Button
                onClick={() => {
                  setIsEditing("edit");
                }}
                style="button buttonType4 textBold textXXS mt-2"
                name="Edit"
              />
              <div className="attendanceCardApprovalContainer">
                <Button
                  onClick={() => {
                    setIsEditing("clockIn");
                  }}
                  style="button buttonType4 textBold textXXS mt-2"
                  name="Edit Clock In"
                />
                <Button
                  onClick={() => {
                    setIsEditing("clockOut");
                  }}
                  style="button buttonType4 textBold textXXS mt-2"
                  name="Edit Clock Out"
                />
              </div>
            </>
          )}
        </>
      )}

      {mode === "hr" &&
        isEditing !== "none" &&
        activity.event_source === "App" && (
          <DataForm
            columns={
              isEditing === "clockIn"
                ? clockInColumns
                : isEditing === "clockOut"
                  ? clockOutColumns
                  : columns
            }
            rowData={activity}
            onSave={handleRequestSave}
            onDelete={handleRequestDelete}
            onCancel={() => setIsEditing("none")}
            saving={saving}
            deleting={deleting}
            inlineForm
          />
        )}
    </div>
  );
}
