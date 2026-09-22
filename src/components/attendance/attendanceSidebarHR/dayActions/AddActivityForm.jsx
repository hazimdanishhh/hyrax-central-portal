import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import Button from "../../../buttons/button/Button";
import SelectEditor from "../../../dataTable/editors/SelectEditor";
import TextareaEditor from "../../../dataTable/editors/TextareaEditor";
import LoadingIcon from "../../../loadingIcon/LoadingIcon";
import { parseRpcErrorDetails } from "@/features/_shared/parseRpcErrorDetails";
import { fetchAttendanceBackfillPrefill } from "@/features/hr/attendance/private/api/attendanceBackfillService";
import useAttendanceBackfill from "@/features/hr/attendance/private/hooks/useAttendanceBackfill";
import useAttendanceAdjustmentReasons from "@/features/hr/attendance/private/hooks/useAttendanceAdjustmentReasons";
import { useAttendanceActivitiesMetadata } from "@/features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import {
  DAY_SHAPES,
  defaultTimesForShape,
  isFullDayType,
} from "../../attendanceBackfillWizard/backfillWizardUtils";
import "./DayActions.scss";

/**
 * Inline "this day is missing an activity" form, rendered inside a day's
 * Activity Timeline.
 *
 * This is the FIXING surface -- the one a reconciliation email should land you
 * on. It lives at sidebar level rather than inside AttendanceTimelineCard
 * because that component early-returns for Leave/Holiday rows and gates on
 * event_source === "App", so on an absent day (the case that matters most) it
 * renders no card at all to hang a button off.
 *
 * Employee and date are NOT fields: they are fixed by the day you opened, and
 * the sidebar header already shows both. Making them editable here would just
 * be a way to be wrong.
 *
 * Writes through create_attendance_backfill (a one-row batch) rather than a
 * direct insert, which is what makes "self" and "manager" modes correct at all:
 * entry_method, approval_status and approved_by are derived server-side from
 * auth.uid(), so an employee recording their own missing day lands Pending and
 * cannot self-approve. It also inherits the overlap guard -- nothing else stops
 * you adding a second activity that double-counts the day's hours.
 *
 * Hand-rolled rather than using DataForm because the time inputs must re-seed
 * when the day shape changes, and DataForm evaluates its defaultValues once at
 * mount. Same approach as AttendanceBackfillWizard, so the two "add attendance"
 * surfaces behave identically.
 */
export default function AddActivityForm({
  employeeId,
  workDateIso,
  onCancel,
  onSaved,
  isSelf,
}) {
  const { attendanceTypes } = useAttendanceActivitiesMetadata();
  const { adjustmentReasons } = useAttendanceAdjustmentReasons();
  const { runCommit, committing } = useAttendanceBackfill();

  const [attendanceTypeId, setAttendanceTypeId] = useState("");
  const [adjustmentReasonId, setAdjustmentReasonId] = useState("");
  const [dayShape, setDayShape] = useState("full");
  const [clockIn, setClockIn] = useState(null); // null = follow the shape
  const [clockOut, setClockOut] = useState(null);
  const [notes, setNotes] = useState("");
  const [skipMessage, setSkipMessage] = useState("");

  // This employee's own shift end (KL 17:00 / Meru 17:30) and any real scan
  // already on record that day. Read through the same RPC the wizard uses, so
  // both surfaces derive identical defaults from identical data.
  const { data: prefillRows, isLoading: prefillLoading } = useQuery({
    queryKey: ["attendance_backfill_prefill", employeeId, workDateIso],
    queryFn: () =>
      fetchAttendanceBackfillPrefill({
        employeeIds: [employeeId],
        dates: [workDateIso],
      }),
    enabled: Boolean(employeeId && workDateIso),
  });

  const prefill = prefillRows?.[0];
  const selectedType = attendanceTypes.find(
    (t) => String(t.id) === String(attendanceTypeId),
  );
  const selectedReason = adjustmentReasons.find(
    (r) => String(r.id) === String(adjustmentReasonId),
  );
  const fullDay = isFullDayType(selectedType);

  // Times the form will submit unless the user overrides them. A real scan on
  // either side wins over the synthetic default -- otherwise "forgot to tap
  // out" would overwrite a genuine 08:33 arrival with 08:30 and assert a time
  // nobody observed.
  const autoTimes = useMemo(() => {
    const base = defaultTimesForShape(dayShape, prefill?.shift_end_time);
    return {
      clockIn: prefill?.hw_check_in
        ? String(prefill.hw_check_in).slice(11, 16)
        : base.clockIn,
      clockOut: prefill?.hw_check_out
        ? String(prefill.hw_check_out).slice(11, 16)
        : base.clockOut,
      inFromScan: Boolean(prefill?.hw_check_in),
      outFromScan: Boolean(prefill?.hw_check_out),
    };
  }, [dayShape, prefill]);

  const effectiveIn = clockIn ?? autoTimes.clockIn;
  const effectiveOut = clockOut ?? autoTimes.clockOut;

  const canSave =
    attendanceTypeId &&
    adjustmentReasonId &&
    (!selectedReason?.requires_notes || notes.trim()) &&
    (fullDay || (effectiveIn && effectiveOut && effectiveIn < effectiveOut));

  async function handleSave() {
    setSkipMessage("");
    try {
      const data = await runCommit({
        rows: [
          {
            employee_id: employeeId,
            work_date: workDateIso,
            attendance_type_id: String(attendanceTypeId),
            adjustment_reason_id: String(adjustmentReasonId),
            notes: notes || null,
            // A whole-day type sends only the shape; the server derives the
            // times from the employee's work location and ignores any times
            // sent anyway.
            day_shape: dayShape,
            clock_in_time: fullDay ? null : effectiveIn,
            clock_out_time: fullDay ? null : effectiveOut,
          },
        ],
        allowLeaveConflict: false,
      });

      // A skip is a normal outcome, not an error -- the RPC resolves rather
      // than throws. Keep the form open and say why.
      if (!data?.addedCount) {
        const reason = data?.rows?.[0]?.reason;
        setSkipMessage(
          reason
            ? `Not added: ${String(reason).replaceAll("_", " ")}.`
            : "Nothing was added.",
        );
        return;
      }

      onSaved?.();
    } catch (err) {
      const { message } = parseRpcErrorDetails(
        err,
        "Could not add this activity.",
      );
      setSkipMessage(message);
    }
  }

  if (prefillLoading) return <LoadingIcon />;

  return (
    <div className="generalCard cardPaddingSmall cardGapSmall dayActionForm">
      <p className="textBold textXS">
        {isSelf ? "Report Missing Activity" : "Add Activity"}
      </p>

      <SelectEditor
        value={attendanceTypeId}
        onChange={setAttendanceTypeId}
        options={attendanceTypes.map((t) => ({ label: t.name, value: t.id }))}
        placeholder="What were you doing?"
      />

      <div className="dayActionRow">
        <select
          className="dayActionShapeSelect"
          value={dayShape}
          onChange={(e) => {
            setDayShape(e.target.value);
            // Drop any manual override so the new shape's defaults apply.
            setClockIn(null);
            setClockOut(null);
          }}
        >
          {DAY_SHAPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Hidden for a whole-day type -- a business trip has no clock times to
            give, and the server derives them. */}
        {!fullDay && (
          <>
            <input
              type="time"
              className="dayActionTimeInput"
              value={effectiveIn || ""}
              onChange={(e) => setClockIn(e.target.value)}
            />
            <span className="textLight textXXS">–</span>
            <input
              type="time"
              className="dayActionTimeInput"
              value={effectiveOut || ""}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </>
        )}
      </div>

      {!fullDay && (autoTimes.inFromScan || autoTimes.outFromScan) && (
        <p className="textLight textXXS">
          Prefilled from a real scan on this day — only the missing side was
          defaulted.
        </p>
      )}

      <SelectEditor
        value={adjustmentReasonId}
        onChange={setAdjustmentReasonId}
        options={adjustmentReasons.map((r) => ({
          label: r.label,
          value: r.id,
        }))}
        placeholder="Why is this being added by hand?"
      />
      {selectedReason && (
        <p className="textLight textXXS">{selectedReason.description}</p>
      )}

      <TextareaEditor value={notes} onChange={setNotes} />

      {skipMessage && (
        <p className="textRegular textXXS dayActionWarning">{skipMessage}</p>
      )}

      <div className="dayActionButtons">
        <Button
          name="Cancel"
          icon={XIcon}
          style="button buttonType4 textBold textXXS"
          onClick={onCancel}
        />
        <Button
          name="Save"
          icon={CheckIcon}
          style="button buttonType2 approval textBold textXXS"
          onClick={handleSave}
          disabled={!canSave || committing}
        />
      </div>
    </div>
  );
}
