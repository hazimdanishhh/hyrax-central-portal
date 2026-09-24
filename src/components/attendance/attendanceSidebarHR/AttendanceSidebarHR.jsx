import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import AttendanceType from "../attendanceType/AttendanceType";
import {
  CheckIcon,
  ClockUserIcon,
  XIcon,
  WarningCircleIcon,
  CheckCircleIcon,
  PlusCircleIcon,
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
import RowFlagBadge from "../../dataTable/RowFlagBadge";
import { getAnomalyAnchorActivityIds } from "../../../functions/attendanceAnomalyAnchors";
import {
  getDayStateDisplay,
  getDayQualityBadges,
} from "../../../functions/attendanceDayState";
import { getAttendanceReconciliationFlags } from "../../../functions/attendanceReconciliationFlags";
import { formatHours } from "../../../functions/formatDate";
import AddActivityForm from "./dayActions/AddActivityForm";
// SWAP POINT: change AttendanceSubmissionForm back to AddActivityForm
// at the mount below to revert. AddActivityForm itself is untouched.
import AttendanceSubmissionForm from "../attendanceSubmission/AttendanceSubmissionForm";
import AcknowledgeDayPanel from "./dayActions/AcknowledgeDayPanel";
import "./dayActions/DayActions.scss";

export default function AttendanceSidebarHR({
  selectedRow, // This is now the Daily Summary Row
  setSelectedId,
  setModalType,
  setModalOpen,
  clockOutAttendanceActivity,
  mode = "hr", // "hr" | "self" | "manager" -- see AttendanceTimelineCard for what each mode shows
}) {
  // The RAW ISO work date. selectedRow.work_date is NOT usable for this --
  // normalizeUnifiedAttendance overwrites it with a formatted display string
  // ("15 Sep 2026"). The synthetic `id` is built as
  // `${employee_uuid}_${work_date}` on the line BEFORE that overwrite, so it
  // holds the only surviving ISO copy on this row.
  //
  // This also fixes a latent bug: fetchEmployeeDayDetails below used to be
  // passed the formatted string, and worked only because Postgres happens to
  // parse "15 Sep 2026" as a date.
  const workDateIso = useMemo(
    () => selectedRow?.id?.split("_")[1] ?? null,
    [selectedRow?.id],
  );

  // 1. Fetch the granular timeline for THIS employee on THIS day
  const { data: timelineData, isLoading } = useQuery({
    queryKey: [
      "attendance_activities",
      selectedRow?.employee_uuid,
      workDateIso,
    ],
    queryFn: () =>
      fetchEmployeeDayDetails(selectedRow?.employee_uuid, workDateIso),
    enabled: !!selectedRow?.employee_uuid && !!workDateIso,
  });

  // The day's headline label, from day_state -- no weekend override needed.
  // See AttendanceCard.jsx's matching comment.
  const dayStateDisplay = getDayStateDisplay(selectedRow?.day_state);

  // Data-quality / approval badges, each an independent axis. In the sidebar
  // these matter more than anywhere else: this is the screen HR uses to decide
  // what to DO about a day, and "approved but the session was never clocked
  // out" was previously unrepresentable -- hr_flag's 'Approved' branch sat
  // above 'Missing App Check-Out', so the open session simply vanished.
  const qualityBadges = getDayQualityBadges(selectedRow || {});
  // Second, independent tag for a weekend actually WORKED. Reads
  // is_worked_on_weekend directly -- see AttendanceCard.jsx's matching comment
  // for why inferring it from `is_weekend && hr_flag !== "Absent"` tagged
  // unworked weekends that happened to fall on leave or a public holiday.
  const showWorkedWeekendTag = Boolean(selectedRow?.is_worked_on_weekend);

  const reconciliationFlags = getAttendanceReconciliationFlags(
    selectedRow || {},
  );

  const [addingActivity, setAddingActivity] = useState(false);

  // Which single timeline card produced this day's late-arrival /
  // early-leave flags -- see getAnomalyAnchorActivityIds for why only one
  // card may carry each.
  const { earliestActivityId, latestActivityId } = React.useMemo(
    () => getAnomalyAnchorActivityIds(timelineData),
    [timelineData],
  );

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

          {/* The day's headline label, from day_state via the one shared
              mapping every other surface uses (AttendanceCard.jsx,
              TodayAttendanceCard.jsx). This was once a hand-duplicated ternary
              here that recognized only On Leave/Review Required/Approved/OK
              and silently defaulted everything else -- Weekend, Absent, Public
              Holiday -- to red, as if they were errors. */}
          <StatusBox
            status={dayStateDisplay.label}
            type={dayStateDisplay.type}
          />

          {/* Data-quality / approval badges -- independent axes, so a day can
              carry several at once. */}
          {qualityBadges.map((b) => (
            <StatusBox key={b.label} status={b.label} type={b.type} />
          ))}

          {/* Worked-on-a-weekend fact, kept separate so it stays visible on a
              Saturday that is also a public holiday, where the day-state label
              leads with the holiday but the rest-day entitlement is still
              owed. */}
          {showWorkedWeekendTag && <StatusBox status="Weekend" type="grey" />}

          {/* Needs Reconciliation warning, same RowFlagBadge the list cards
              use (AttendanceCard.jsx) so the badge HR clicked through from is
              still visible once the day is open -- rather than making them
              re-derive which flag fired from the action buttons below.
              reconciliationFlags was being computed here but never rendered,
              so this badge was silently missing from the sidebar. */}
          <RowFlagBadge
            items={reconciliationFlags}
            tooltipTitle="Needs Reconciliation"
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
          <AttendanceClock
            time={selectedRow.first_in_time}
            type="clockin"
            isAnomaly={selectedRow.is_late_arrival}
          />
        )}
        {selectedRow.last_out_time && (
          <AttendanceClock
            time={selectedRow.last_out_time}
            type="clockout"
            isAnomaly={selectedRow.is_early_leave}
          />
        )}
      </div>

      <div className="attendanceCardSidebarHeader">
        <p className="textBold textS">
          {formatHours(selectedRow.hours_worked)} worked
        </p>
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

      {/* DAY-LEVEL ACTIONS -- the fixing surface. These live here rather than
          on a timeline card because AttendanceTimelineCard early-returns for
          Leave/Holiday rows and gates on event_source === "App": on an absent
          day (exactly the day reconciliation cares about) there is no card at
          all to hang a button off. */}
      <div className="dayActionHeader">
        <p className="textBold textS">Activity Timeline</p>
      </div>

      {!addingActivity && workDateIso && (
        <Button
          name={mode === "self" ? "Report Missing Activity" : "Add Activity"}
          icon={PlusCircleIcon}
          style="button buttonType4 greenFill textBold textXXS"
          onClick={() => setAddingActivity(true)}
        />
      )}

      {addingActivity && workDateIso && (
        // AttendanceSubmissionForm's lockDate mode: same fields and logic as
        // HR's own "Add Activity" flow (type, reason, day shape/times, photo,
        // notes, calendar-context tags), minus a date/employee picker -- both
        // are already fixed by the day this sidebar is open on. isSelf is not
        // passed: create_attendance_submission derives Pending-vs-Approved
        // from auth.uid() itself, the same "who is actually asking" check
        // AddActivityForm's own header comment describes, so there is nothing
        // for the caller to assert.
        <AttendanceSubmissionForm
          employeeId={selectedRow.employee_uuid}
          workDateIso={workDateIso}
          lockDate
          onCancel={() => setAddingActivity(false)}
          onSaved={() => setAddingActivity(false)}
          sidebar={true}
        />
      )}

      {/* Acknowledging a flag that is CORRECT as it stands. HR only, since
          waving away short half-day hours is to the employee's advantage.

          There was a second mount here for category="absent" until
          2026-09-23. An absent day is not closed by declaring it closed -- it
          is closed by recording it in HR2000 (as NPL if genuinely unpaid),
          which the next leave sync turns into an `on_leave` day, or by adding
          the attendance activity if they did work. acknowledge_attendance_day
          now rejects 'absent' outright; this is just the UI agreeing. */}
      {workDateIso &&
        mode === "hr" &&
        selectedRow?.is_insufficient_half_day_hours && (
          <AcknowledgeDayPanel
            employeeId={selectedRow.employee_uuid}
            workDateIso={workDateIso}
            category="insufficient_half_day"
            canAcknowledge
            canRevoke
          />
        )}

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
              isLateArrival={
                !!selectedRow?.is_late_arrival &&
                activity.activity_id === earliestActivityId
              }
              isEarlyLeave={
                !!selectedRow?.is_early_leave &&
                activity.activity_id === latestActivityId
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
