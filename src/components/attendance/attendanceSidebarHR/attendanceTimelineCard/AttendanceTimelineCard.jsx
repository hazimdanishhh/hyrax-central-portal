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
import DataForm from "../../../crud/dataForm/DataForm";
import StatusBadge from "../../../status/statusBadge/StatusBadge";
import StatusBox from "../../../status/statusBox/StatusBox";
import AttendanceType from "../../attendanceType/AttendanceType";
import AttendanceDayTimelineBar from "../../attendanceDayTimelineBar/AttendanceDayTimelineBar";
import { attendanceActivityTableConfig } from "./tableConfig";
import AttendanceClock from "../../attendanceClock/AttendanceClock";
import { formatTime } from "@/functions/formatDate";
import "./AttendanceTimelineCard.scss";

// "3h 25m" / "45m" / "8h" -- shared by the per-pair duration list and the
// two headline hour totals below it.
function formatMinutesDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// "8:36 AM - 12:01 PM (3h 25m)" -- HR auditing needs the actual duration of
// each inferred in/out pair spelled out, not just visible on a bar segment's
// hover tooltip.
function formatPairDuration(startIso, endIso) {
  const totalMinutes = Math.max(
    0,
    Math.round((new Date(endIso) - new Date(startIso)) / 60000),
  );
  return formatMinutesDuration(totalMinutes);
}

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
  // buttons below. Fetched eagerly for Hardware rows (not lazy-on-click
  // anymore) -- the odd/even pair breakdown below is now this card's
  // primary content, not a supplementary drill-down, so it can't wait for
  // a click. `scansExpanded` still gates only the fully raw, ungrouped
  // scan list further down.
  const [scansExpanded, setScansExpanded] = useState(false);
  const { scans, isLoading: scansLoading } = useAttendanceLogScans({
    employeeCode: activity.company_employee_code,
    scannerLocation: activity.attendance_type,
    workDate: activity.work_date,
    enabled: activity.event_source === "Hardware",
  });

  // Odd = in, even = out -- the actual in/out pairs a "Hardware" summary
  // card's check_in_time/check_out_time (MIN/MAX across every scan that
  // day) was built from. Purely a display aid for HR auditing -- NOT used
  // anywhere for hours_worked/hr_flag, which stay computed independently in
  // unified_daily_attendance's own daily_hardware CTE (positional pairing
  // was deliberately rejected for that calculation earlier this session --
  // employees routinely forget to scan in or out, which would corrupt a
  // positional pairing there).
  //
  // App rows have no separate raw-scan concept -- attendance_activities
  // already IS one real clock-in/clock-out session -- so they get the same
  // shape as a single one-item "pair", giving every card (App or Hardware)
  // the same bar + breakdown + two-totals treatment below from one shared
  // code path.
  const pairedSegments =
    activity.event_source === "Hardware"
      ? scans.reduce((pairs, scan, i) => {
          if (i % 2 === 0) {
            pairs.push({
              attendance_type: activity.attendance_type,
              event_source: "Hardware",
              check_in_time: scan.scanned_at,
              check_out_time: scans[i + 1]?.scanned_at ?? null,
            });
          }
          return pairs;
        }, [])
      : activity.check_in_time
        ? [
            {
              attendance_type: activity.attendance_type,
              event_source: "App",
              check_in_time: activity.check_in_time,
              check_out_time: activity.check_out_time ?? null,
            },
          ]
        : [];

  // Number 1: the naive full span, first in to last seen -- what
  // check_in_time/check_out_time already say for this activity as a whole.
  const firstInToLastSeenMinutes =
    activity.check_in_time && activity.check_out_time
      ? Math.round(
          (new Date(activity.check_out_time) -
            new Date(activity.check_in_time)) /
            60000,
        )
      : null;

  // Number 2: sum of only the COMPLETE pairs (skips a trailing scan with no
  // matching out yet -- there's nothing to compute a duration from). For
  // Hardware this is the real audit signal: it reveals any gap between
  // genuinely scanned pairs (e.g. a lunch break) that Number 1 silently
  // counts as if it were continuously on-site. For App there's normally
  // only one pair, so this equals Number 1 whenever the session has ended.
  const scannedPairsMinutes = pairedSegments.reduce((total, seg) => {
    if (!seg.check_out_time) return total;
    return (
      total +
      Math.round(
        (new Date(seg.check_out_time) - new Date(seg.check_in_time)) / 60000,
      )
    );
  }, 0);

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

      {/* ODD/EVEN IN-OUT PAIR BREAKDOWN -- for Hardware, this card's
          check_in_time/check_out_time is a MIN/MAX summary across possibly
          several raw attendance_logs scans that day; HR needs to see the
          actual in-out-in-out pattern underneath it to judge whether
          stricter scanner discipline (always scan in AND out, never skip)
          needs enforcing. For App there's only ever one real pair
          (attendance_activities already is a clean session), shown the
          same way for visual consistency across every card. Reuses the
          exact same AttendanceDayTimelineBar the sidebar's own full-day bar
          uses, fed synthetic pair "activities" instead of real
          attendance_activity_audit rows -- same visual language, same
          hover tooltips, no new bar component needed. */}
      {scansLoading ? (
        <LoadingIcon />
      ) : (
        pairedSegments.length > 0 && (
          <>
            <AttendanceDayTimelineBar timelineData={pairedSegments} />
            <div className="attendanceScanLogList">
              {pairedSegments.map((seg, i) => (
                <p
                  key={`${seg.check_in_time}-${i}`}
                  className="textRegular textXXS"
                >
                  <span className="textBold">{i + 1}.</span>{" "}
                  {formatTime(seg.check_in_time)}
                  {seg.check_out_time
                    ? ` – ${formatTime(seg.check_out_time)} (${formatPairDuration(seg.check_in_time, seg.check_out_time)})`
                    : " – no matching out scan yet"}
                </p>
              ))}
            </div>

            {/* Two totals, deliberately kept separate rather than reduced
                to one number: Number 1 is the naive full span (what
                check_in_time/check_out_time already say); Number 2 only
                counts complete pairs, so it excludes any trailing unpaired
                scan and reveals gaps Number 1 silently papers over (e.g. a
                scanned-out lunch break). They agree exactly when there's
                only one pair with no gap -- the normal App case. */}
            <div className="attendanceCardSidebarHeader">
              <p className="textRegular textXXS">
                First In → Last Seen:{" "}
                <span className="textBold">
                  {firstInToLastSeenMinutes != null
                    ? formatMinutesDuration(firstInToLastSeenMinutes)
                    : "Ongoing"}
                </span>
              </p>
              <p className="textRegular textXXS">
                Total From Pairs:{" "}
                <span className="textBold">
                  {formatMinutesDuration(scannedPairsMinutes)}
                </span>
              </p>
            </div>
          </>
        )
      )}

      {/* SCAN-LOG VERIFICATION -- the fully raw, ungrouped scan list this
          card's pair breakdown above was derived from, in case HR needs to
          double check the ground truth directly (e.g. an unexpected extra
          scan). Inline expand, not a second sidebar -- usually just a
          handful of rows. */}
      {activity.event_source === "Hardware" && (
        <>
          <Button
            onClick={() => setScansExpanded((prev) => !prev)}
            icon={scansExpanded ? CaretUpIcon : CaretDownIcon}
            style="button buttonType4 textBold textXXS"
            name={scansExpanded ? "Hide Raw Scan Log" : "Show Raw Scan Log"}
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
