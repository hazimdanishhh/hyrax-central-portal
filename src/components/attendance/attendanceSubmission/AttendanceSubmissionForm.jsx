import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  XIcon,
  PencilSimpleIcon,
  CalendarDotsIcon,
} from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import IconCard from "../../iconCard/IconCard";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import SelectEditor from "../../dataTable/editors/SelectEditor";
import TextareaEditor from "../../dataTable/editors/TextareaEditor";
import ImageUploadEditor from "../../dataTable/editors/ImageUploadEditor";
import useAttendanceSubmission from "@/features/hr/attendance/private/hooks/useAttendanceSubmission";
import useAttendanceAdjustmentReasons from "@/features/hr/attendance/private/hooks/useAttendanceAdjustmentReasons";
import { fetchAttendanceBackfillPrefill } from "@/features/hr/attendance/private/api/attendanceBackfillService";
import { useAttendanceActivitiesMetadata } from "@/features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import {
  DAY_SHAPES,
  expandDateRange,
  formatDateLabel,
  isFullDayType,
  shouldPreselectDate,
  todayDateString,
} from "../attendanceBackfillWizard/backfillWizardUtils";
import {
  submissionHeaderConfig,
  buildDayRow,
  validateDays,
} from "./submissionTableConfig";
import { validateSubmission, toSubmissionDays } from "./submissionUtils";

// Borrows BOTH existing vocabularies rather than inventing a third:
//   - DataForm.scss / DataSidebar.scss  -> dataSidebarContent, dataSidebarSection,
//     dataSidebarSectionFields, dataSidebarField, dataFormFooter
//   - AttendanceBackfillWizard.scss     -> backfillDateList, backfillDateRow,
//     backfillDateLabel, backfillCheckbox, backfillShapeSelect,
//     backfillDateTimes, backfillTimeInput
//
// Every class above is already defined and already used by the two things
// this sits between, so it inherits their look for free -- and any later
// restyle of either reaches this too. AttendanceSubmissionForm.scss adds only
// what neither of those owns: this form's own container/footer layout and the
// `sidebar` variant used when it is embedded inline in the day sidebar rather
// than inside its own DataSidebar (see the `sidebar` prop below).
import "../attendanceBackfillWizard/AttendanceBackfillWizard.scss";
import { useTheme } from "../../../context/ThemeContext";
import "./AttendanceSubmissionForm.scss";

/**
 * ONE attendance submission: one employee, one type, one reason, one photo,
 * one note -- across a date range, each date carrying its own shape and times.
 *
 * Saving once creates one row per selected date. That is the feature: a
 * four-day business trip is a single act with a single piece of evidence, not
 * four unrelated entries that happen to look alike. Today an employee would
 * attach their evidence four times, or -- since the bulk wizard has no concept
 * of a photo -- not at all.
 *
 * TWO MODES, one component:
 *   - Free-ranging (default) -- HR/My/Team Attendance's own "add attendance"
 *     buttons. Employee and dates are both pickable.
 *   - `lockDate` -- the day sidebar's "Add Activity"/"Report Missing Activity".
 *     Employee and the single date are BOTH fixed by the day already being
 *     viewed; there is no range picker and no per-date checkbox, because there
 *     is nothing to range across or exclude. Everything else -- type, reason,
 *     shape/times, photo, notes, and the calendar-context tags -- is identical
 *     to the free-ranging mode, which is the whole point: this is the same
 *     form the sidebar's own AddActivityForm approximated by hand, minus the
 *     one field it never had (photo).
 *
 * ENTIRELY ADDITIVE. Nothing existing was modified to make this work:
 * create_attendance_backfill, the Backfill wizard, the sidebar's
 * AddActivityForm and HR's createAttendanceActivityFormConfig are all
 * untouched and still exist as files -- only their MOUNT POINTS were swapped
 * for this component. Reverting any one of them is a one-line change back to
 * the original component name at that mount point.
 *
 * NOT for live clock-in. Starting a session now is a different act -- it has
 * no end time yet, and it is the one case where an open session is correct.
 * That stays on useClockInOutAction.
 */
export default function AttendanceSubmissionForm({
  // Locked when the surface already knows who. My Attendance passes the
  // signed-in employee; the day sidebar passes the row it was opened from.
  employeeId: lockedEmployeeId,
  // Narrows the picker only -- Team Attendance passes direct reports. It
  // grants nothing: the RPC re-derives the caller's rights from auth.uid().
  employeeOptions,
  // Pre-selects a single date, for surfaces opened on one specific day.
  workDateIso,
  // FIXES the date to workDateIso -- no range picker, no per-date checkbox.
  // The day sidebar already knows exactly which day this is; offering a range
  // there would let someone widen an "add activity for THIS day" action into
  // "add activity for a week", which is what the date range field is for
  // elsewhere, not what a day-scoped surface should invite.
  lockDate = false,

  onCancel,
  onSaved,
  // True when embedded inline in the day sidebar's own panel (lockDate's
  // caller) rather than mounted inside its own DataSidebar
  // (AttendanceSubmissionSidebar's caller, which already supplies the card
  // chrome). Swaps in AttendanceSubmissionForm.scss's compact bordered variant
  // so the form doesn't render as a second, redundant card inside a panel
  // that is already one.
  sidebar = false,
}) {
  const { darkMode } = useTheme();
  const { employees, attendanceTypes, workLocations, isLoading } =
    useAttendanceActivitiesMetadata();
  const { adjustmentReasons } = useAttendanceAdjustmentReasons();
  const { submitAttendance, submitting } = useAttendanceSubmission();

  const [employeeId, setEmployeeId] = useState(lockedEmployeeId || "");
  const [attendanceTypeId, setAttendanceTypeId] = useState("");
  const [adjustmentReasonId, setAdjustmentReasonId] = useState("");
  const [photo, setPhoto] = useState(null);
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState(workDateIso || todayDateString());
  const [endDate, setEndDate] = useState(workDateIso || todayDateString());
  const [days, setDays] = useState([]);

  // CALENDAR CONTEXT -- same purpose AttendanceBackfillWizard's own
  // dateContext serves: warn about a date before it is submitted, rather than
  // after. get_attendance_backfill_prefill is security_invoker (no
  // authorization logic of its own -- see that RPC's header), so it naturally
  // scopes to whatever the caller may already see: self, direct reports, or
  // everyone. Reused as-is rather than re-fetched some other way.
  const [prefillRows, setPrefillRows] = useState([]);
  const [prefillLoading, setPrefillLoading] = useState(false);

  // Dates the user has personally touched (ticked/unticked, or edited the
  // shape/times). A ref, not state: it is written from inside a setDays
  // updater and read from a later effect, and it must never itself trigger a
  // re-render -- only the `days` state it guards should do that.
  //
  // Exists so the prefill auto-preselect effect below can never clobber a
  // choice the user already made -- e.g. deliberately including a weekend day
  // they actually worked.
  const touchedDatesRef = useRef(new Set());

  const selectedType = useMemo(
    () =>
      attendanceTypes.find((t) => String(t.id) === String(attendanceTypeId)),
    [attendanceTypes, attendanceTypeId],
  );
  const selectedReason = useMemo(
    () =>
      adjustmentReasons.find(
        (r) => String(r.id) === String(adjustmentReasonId),
      ),
    [adjustmentReasons, adjustmentReasonId],
  );
  const selectedEmployee = useMemo(
    () => employees.find((e) => String(e.id) === String(employeeId)),
    [employees, employeeId],
  );

  const fullDay = isFullDayType(selectedType);

  // employees carries work_location_id, NOT an embedded object
  // (attendanceActivitiesMetadataService fetches the locations separately), so
  // the cutoff is resolved here. Reading this wrong would not error -- it
  // would silently give every Meru employee KL's 17:00 finish and shorten
  // their full day by half an hour.
  const shiftEndTime = useMemo(
    () =>
      (workLocations || []).find(
        (w) => String(w.id) === String(selectedEmployee?.work_location_id),
      )?.early_leave_time,
    [workLocations, selectedEmployee?.work_location_id],
  );

  // The expanded date list, shared by the grid, the prefill fetch and the
  // calendar-context memo below -- one computation rather than three that
  // could drift out of step with each other.
  //
  // lockDate short-circuits this to the one fixed day rather than reading
  // startDate/endDate at all -- those two pieces of state still exist (the
  // date-range effect below still needs somewhere to seed from) but are never
  // shown or edited in this mode.
  const rangeDates = useMemo(() => {
    if (lockDate) return workDateIso ? [workDateIso] : [];
    return startDate && endDate && endDate >= startDate
      ? expandDateRange(startDate, endDate)
      : [];
  }, [lockDate, workDateIso, startDate, endDate]);

  // Rebuild the grid whenever the range or the employee's shift end changes.
  // Any row the user had already adjusted is preserved by date, so widening a
  // range by a day does not silently discard the times they just set.
  useEffect(() => {
    setDays((previous) => {
      const kept = new Map(previous.map((d) => [d.workDate, d]));
      return rangeDates.map(
        (date) => kept.get(date) ?? buildDayRow(date, "full", shiftEndTime),
      );
    });
  }, [rangeDates, shiftEndTime]);

  // FETCH CALENDAR CONTEXT for this employee across the range -- weekends,
  // public holidays, existing leave, existing attendance. Same RPC/service the
  // Backfill wizard uses, called here for a single employee instead of the
  // wizard's own multi-employee list.
  useEffect(() => {
    let cancelled = false;

    if (!employeeId || rangeDates.length === 0) {
      setPrefillRows([]);
      return undefined;
    }

    setPrefillLoading(true);
    fetchAttendanceBackfillPrefill({
      employeeIds: [employeeId],
      dates: rangeDates,
    })
      .then((rows) => {
        if (!cancelled) setPrefillRows(rows);
      })
      .catch(() => {
        if (!cancelled) setPrefillRows([]);
      })
      .finally(() => {
        if (!cancelled) setPrefillLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId, rangeDates]);

  // Per-date context, one employee -- same fields AttendanceBackfillWizard's
  // own dateContext computes, minus the "collapsed across several employees"
  // counts, since there is only ever one here.
  const dateContext = useMemo(() => {
    const map = {};
    for (const date of rangeDates) {
      const rows = prefillRows.filter((r) => r.work_date === date);
      map[date] = {
        isWeekend: rows.some((r) => r.is_weekend),
        isPublicHoliday: rows.some((r) => r.is_public_holiday),
        holidayName: rows.find((r) => r.public_holiday_name)
          ?.public_holiday_name,
        isOnLeave: rows.some((r) => r.is_on_leave),
        hasExistingAttendance: rows.some((r) => r.has_existing_attendance),
        // No prefill row at all means this date isn't in
        // unified_daily_attendance's spine: no company-wide activity, and not
        // a weekend or public holiday -- same meaning the wizard gives this.
        // Suppressed while still loading (or before an employee is chosen) so
        // every date doesn't flash this tag before the fetch resolves.
        notInSpine: Boolean(employeeId) && !prefillLoading && rows.length === 0,
      };
    }
    return map;
  }, [rangeDates, prefillRows, prefillLoading, employeeId]);

  // Once the fetch resolves, un-tick dates that shouldn't default to selected
  // (a weekend, a holiday, a day already on record, a full-day leave already
  // logged) -- but only for dates the user has not personally touched yet.
  // Rows start selected (see buildDayRow) so the grid is usable immediately,
  // before the network round trip completes; this only ever narrows that
  // default down, and only once, per date.
  useEffect(() => {
    // A locked date is being added BECAUSE of what it is -- a weekend that was
    // actually worked, a day already flagged, whatever brought someone to this
    // specific day in the sidebar. Auto-unticking it for exactly those reasons
    // would fight the reason they opened this form. The tags below still show
    // all of that context; they just stop being able to exclude the day.
    if (prefillLoading || lockDate) return;

    setDays((previous) =>
      previous.map((d) => {
        if (touchedDatesRef.current.has(d.workDate)) return d;
        const rowsForDate = prefillRows.filter(
          (r) => r.work_date === d.workDate,
        );
        const shouldSelect = shouldPreselectDate(rowsForDate);
        return d.selected === shouldSelect
          ? d
          : { ...d, selected: shouldSelect };
      }),
    );
  }, [prefillRows, prefillLoading, lockDate]);

  function updateDay(workDate, patch) {
    // Recorded BEFORE the state update. Guards the prefill auto-preselect
    // effect above -- once a date is here, that effect leaves its `selected`
    // value alone permanently, even after a later fetch resolves.
    touchedDatesRef.current.add(workDate);

    setDays((previous) =>
      previous.map((d) => {
        if (d.workDate !== workDate) return d;
        const next = { ...d, ...patch };
        // Changing the shape RE-SEEDS that row's times. The shape is not a
        // label on times chosen separately -- it is what they mean. Same
        // reasoning the wizard's own shape selector applies when it clears a
        // manual override.
        if (patch.dayShape && patch.dayShape !== d.dayShape) {
          const seeded = buildDayRow(workDate, patch.dayShape, shiftEndTime);
          next.clockIn = seeded.clockIn;
          next.clockOut = seeded.clockOut;
        }
        return next;
      }),
    );
  }

  // employeeOptions (the prop) arrives PRE-SHAPED as [{label, value}] from HR
  // and Team Attendance's own mounts -- it must be passed straight through,
  // not mapped again. Only when no override was given (My Attendance, which
  // has no picker at all since its employee is locked) is the raw metadata
  // list mapped here.
  const employeeSelectOptions = useMemo(
    () =>
      employeeOptions ||
      employees.map((e) => ({ label: e.full_name, value: e.id })),
    [employeeOptions, employees],
  );

  const headerColumns = submissionHeaderConfig({
    employeeOptions: employeeSelectOptions,
    attendanceTypes,
    adjustmentReasons,
    lockedEmployee: Boolean(lockedEmployeeId),
  });

  const dayProblems = validateDays(days, { isFullDay: fullDay });
  const problems = validateSubmission({
    employeeId,
    attendanceTypeId,
    adjustmentReasonId,
    days,
    notes,
    photo,
    selectedType,
    selectedReason,
    dayProblems,
  });

  const selectedCount = days.filter((d) => d.selected).length;
  const canSave = problems.length === 0 && !submitting;

  // One place mapping a header column key to its state, so the render stays a
  // loop over the config rather than a hand-written field per key -- which is
  // what let the existing forms drift apart in the first place.
  const headerState = {
    employeeId: [employeeId, setEmployeeId],
    attendanceTypeId: [attendanceTypeId, setAttendanceTypeId],
    adjustmentReasonId: [adjustmentReasonId, setAdjustmentReasonId],
    photo: [photo, setPhoto],
    notes: [notes, setNotes],
  };

  async function handleSave() {
    if (!canSave) return;
    try {
      const result = await submitAttendance({
        employeeId,
        attendanceTypeId: Number(attendanceTypeId),
        adjustmentReasonId: Number(adjustmentReasonId),
        days: toSubmissionDays(days, { isFullDay: fullDay }),
        notes: notes || null,
        photo,
      });
      // Only close on a real write. A submission where every date was skipped
      // leaves the form open with the hook's own message, so the user can
      // adjust the range rather than wonder what happened.
      if (result?.addedCount > 0) onSaved?.(result);
    } catch {
      // The hook surfaces the RPC's own message, which is written to be shown
      // verbatim ("A half day cannot exceed 4 hours"). Nothing to add here.
    }
  }

  if (isLoading) {
    // Same container class (and sidebar variant) the loaded return uses below
    // -- otherwise the panel visibly resizes the instant metadata arrives,
    // since dataSidebarContent/inlineForm carry different padding.
    return (
      <div
        className={`attendanceSubmissionFormContainer${sidebar ? " sidebarAttendanceSubmissionFormContainer" : ""}`}
      >
        <LoadingIcon />
      </div>
    );
  }

  return (
    <div
      className={`attendanceSubmissionFormContainer${sidebar ? ` sidebarAttendanceSubmissionFormContainer` : ``}`}
    >
      {/* SECTION 1 -- what is true of the whole submission.
          Same markup DataForm generates for a section: heading card, then one
          dataSidebarField per column. */}
      <div className="dataSidebarSection">
        <div className="dataSidebarSectionFields cardStyle">
          <div className="dataSidebarSectionHeader">
            <IconCard
              icon={PencilSimpleIcon}
              name="Activity"
              style="textXS textBold"
            />
          </div>

          {headerColumns.map((col) => {
            const [value, setter] = headerState[col.key];
            const isRequired =
              typeof col.required === "function"
                ? col.required(
                    {
                      employeeId,
                      attendanceTypeId,
                      adjustmentReasonId,
                      notes,
                      photo,
                    },
                    { selectedType, selectedReason },
                  )
                : col.required;

            return (
              <div key={col.key} className="dataSidebarField">
                <label
                  className={`textBold textXXS ${isRequired ? "required" : ""}`}
                >
                  {col.label}
                  <span className="dataSidebarRequired">
                    {isRequired && "*"}
                  </span>
                </label>

                {col.readOnly ? (
                  <p className="textRegular textXS">
                    {selectedEmployee?.full_name || "—"}
                  </p>
                ) : col.editor === "select" ? (
                  <SelectEditor
                    value={value}
                    onChange={setter}
                    options={col.options}
                    placeholder={col.placeholder}
                    required={isRequired}
                  />
                ) : col.editor === "image" ? (
                  <ImageUploadEditor
                    value={value}
                    onChange={setter}
                    allowReplace
                  />
                ) : (
                  <TextareaEditor value={value} onChange={setter} />
                )}

                {col.key === "adjustmentReasonId" &&
                  selectedReason?.description && (
                    <p className="textLight textXXS">
                      {selectedReason.description}
                    </p>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2 -- the dates. Its own section so the range picker and the
          per-date rows read as one unit, the way the wizard's own date step
          does. */}
      <div className="dataSidebarSection">
        <div className="dataSidebarSectionFields cardStyle">
          <div className="dataSidebarSectionHeader">
            <IconCard
              icon={CalendarDotsIcon}
              name="Dates"
              style="textXS textBold"
            />
          </div>

          <div className="dataSidebarField">
            <label className="textBold textXXS required">
              {lockDate ? "Date" : "Date Range"}
              <span className="dataSidebarRequired">*</span>
            </label>
            {lockDate ? (
              <p className="textRegular textXS">
                {formatDateLabel(workDateIso)}
              </p>
            ) : (
              <div className="attendanceSubmissionDateTimes">
                <input
                  type="date"
                  className="backfillTimeInput"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="textLight textXXS">–</span>
                <input
                  type="date"
                  className="backfillTimeInput"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {prefillLoading && (
            <p className="textLight textXXS">Checking calendar...</p>
          )}

          {fullDay && (
            <p className="textLight textXXS">
              {selectedType?.name} is recorded as a whole day. Times come from
              this employee&apos;s work location.
            </p>
          )}

          {/* One row per date, all editable at once -- the normal case is
              adjusting several before saving once. Uses the wizard's own row
              markup so the two read identically. */}
          {days.length > 0 && (
            <div className="backfillDateList">
              {days.map((day) => {
                const ctx = dateContext[day.workDate] || {};
                return (
                  <div key={day.workDate} className="backfillDateRow">
                    <label className="backfillDateLabel">
                      {/* No checkbox when the date is locked -- there is
                          nothing to exclude it FROM. buildDayRow already
                          defaults `selected` true, and the narrowing effect
                          above is skipped for a locked date, so it simply
                          stays true. */}
                      {!lockDate && (
                        <input
                          className="backfillCheckbox"
                          type="checkbox"
                          checked={day.selected}
                          onChange={(e) =>
                            updateDay(day.workDate, {
                              selected: e.target.checked,
                            })
                          }
                        />
                      )}
                      <span className="textBold textXXS">
                        {formatDateLabel(day.workDate)}
                      </span>

                      {/* Same calendar-context tags AttendanceBackfillWizard
                        shows per date -- weekend/holiday/leave/existing
                        attendance are all things worth knowing BEFORE
                        submitting a day, not after. */}
                      <div className="backfillDateTags">
                        {ctx.isWeekend && (
                          <span className="backfillTag textXS grey">
                            Weekend
                          </span>
                        )}
                        {ctx.isPublicHoliday && (
                          <span className="backfillTag textXS blue">
                            {ctx.holidayName || "Public Holiday"}
                          </span>
                        )}
                        {ctx.isOnLeave && (
                          <span className="backfillTag textXS purple">
                            On leave
                          </span>
                        )}
                        {ctx.hasExistingAttendance && (
                          <span className="backfillTag textXS yellow">
                            Has attendance
                          </span>
                        )}
                        {ctx.notInSpine && (
                          <span className="backfillTag textXS red">
                            Not in attendance calendar
                          </span>
                        )}
                        {day.workDate > todayDateString() && (
                          <span className="backfillTag textXS blue">
                            Future
                          </span>
                        )}
                        {dayProblems[day.workDate] && (
                          <span className="backfillTag textXS red">
                            {dayProblems[day.workDate]}
                          </span>
                        )}
                      </div>
                    </label>

                    {/* The shape shows for every type, including whole-day ones
                      -- a trip can still be a half day. Only the raw time
                      inputs are type-dependent. Same rule as the wizard. */}
                    <select
                      className="backfillShapeSelect"
                      value={day.dayShape}
                      disabled={!day.selected}
                      onChange={(e) =>
                        updateDay(day.workDate, { dayShape: e.target.value })
                      }
                    >
                      {DAY_SHAPES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    {!fullDay && (
                      <div className="backfillDateTimes">
                        <input
                          type="time"
                          className="backfillTimeInput"
                          disabled={!day.selected}
                          value={day.clockIn || ""}
                          onChange={(e) =>
                            updateDay(day.workDate, { clockIn: e.target.value })
                          }
                        />
                        <span className="textLight textXXS">–</span>
                        <input
                          type="time"
                          className="backfillTimeInput"
                          disabled={!day.selected}
                          value={day.clockOut || ""}
                          onChange={(e) =>
                            updateDay(day.workDate, {
                              clockOut: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {problems.length > 0 && (
        <div className="dataSidebarSection">
          {/* <p> as a sibling before the list, not a child of it -- a <ul>
              may only ever contain <li> elements. */}
          <div className="generalCard redCard textRegular textXXS">
            <p className="textBold">Problems:</p>
            <ul>
              {problems.map((p) => (
                <li key={p} className="red attendanceSubmissionProblem">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Same footer DataForm renders for an inline form, same button styles,
          same order (Cancel then Save). */}
      <div
        className={
          darkMode
            ? `attendanceSubmissionFormFooter sectionDark`
            : `attendanceSubmissionFormFooter sectionLight`
        }
      >
        <div className="attendanceSubmissionActionButtons">
          <Button
            name="Cancel"
            icon={XIcon}
            onClick={onCancel}
            type="button"
            disabled={submitting}
            size="14"
            style="button buttonType5 textXXS textRegular"
            weight="bold"
          />
          <Button
            name={
              submitting
                ? "Saving..."
                : `Save ${selectedCount} Day${selectedCount === 1 ? "" : "s"}`
            }
            icon={CheckIcon}
            onClick={handleSave}
            type="button"
            disabled={!canSave}
            size="14"
            style="button buttonType5 approval textXXS textRegular"
            weight="bold"
          />
        </div>
      </div>
    </div>
  );
}
