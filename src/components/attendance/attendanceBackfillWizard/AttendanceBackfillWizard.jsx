import { useState, useMemo, useEffect } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  WarningIcon,
  ArrowClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import DataSidebar from "../../dataSidebar/DataSidebar";
import DataTable from "../../dataTable/DataTable";
import CardLayout from "../../cardLayout/CardLayout";
import Button from "../../buttons/button/Button";
import LoadingIcon from "../../loadingIcon/LoadingIcon";
import StatTile from "../../crud/statTile/StatTile";
import SelectEditor from "../../dataTable/editors/SelectEditor";
import TextareaEditor from "../../dataTable/editors/TextareaEditor";
import EmployeeMultiSelectEditor from "../../dataTable/editors/EmployeeMultiSelectEditor";
import { parseRpcErrorDetails } from "@/features/_shared/parseRpcErrorDetails";
import { fetchAttendanceBackfillPrefill } from "@/features/hr/attendance/private/api/attendanceBackfillService";
import useAttendanceBackfill from "@/features/hr/attendance/private/hooks/useAttendanceBackfill";
import useAttendanceAdjustmentReasons from "@/features/hr/attendance/private/hooks/useAttendanceAdjustmentReasons";
import {
  DAY_SHAPES,
  defaultTimesForShape,
  expandDateRange,
  formatDateLabel,
  isFullDayType,
  shouldPreselectDate,
  todayDateString,
} from "./backfillWizardUtils";
import "../../crud/csvImportModal/CsvImportModal.scss";
import "./AttendanceBackfillWizard.scss";

/**
 * Bulk "record attendance that wasn't captured" wizard.
 *
 * One component, three scopes:
 *   scope="hr"   -- HR Attendance Management, any employee
 *   scope="team" -- Team Attendance, the manager's own direct reports
 *   scope="self" -- My Attendance, the signed-in employee only (step 1 is
 *                   skipped entirely)
 *
 * The scope only decides which employees can be *offered*. It grants nothing:
 * create_attendance_backfill re-derives the caller's rights per row from
 * auth.uid(), using the same three-branch test as approve_attendance, and
 * rejects the whole batch if any row is outside them. Likewise entry_method
 * and approval_status are derived server-side and are not sent from here --
 * so this component cannot be used to self-approve.
 *
 * Built on CsvImportModal's step-machine shell (same DataSidebar fullPage
 * wrapper, same busy/reset handling, same global csvImport* banner/stat
 * classes) rather than a new modal, since it is the same kind of flow:
 * choose -> preview what would happen -> commit -> report.
 */
export default function AttendanceBackfillWizard({
  open,
  onClose,
  scope = "hr",
  employeeOptions = [],
  currentEmployeeId,
  attendanceTypes = [],
}) {
  const isSelfScope = scope === "self";

  // employees -> dates -> details -> preview -> result | error
  const [step, setStep] = useState(isSelfScope ? "details" : "employees");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prefillRows, setPrefillRows] = useState([]);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [dateSelections, setDateSelections] = useState({}); // date -> {selected, shape}
  const [attendanceTypeId, setAttendanceTypeId] = useState("");
  const [adjustmentReasonId, setAdjustmentReasonId] = useState("");
  const [notes, setNotes] = useState("");
  const [allowLeaveConflict, setAllowLeaveConflict] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);

  const { adjustmentReasons } = useAttendanceAdjustmentReasons();
  const { runPreview, previewing, runCommit, committing } =
    useAttendanceBackfill();

  const employeeIds = useMemo(
    () => (isSelfScope ? [currentEmployeeId].filter(Boolean) : selectedEmployeeIds),
    [isSelfScope, currentEmployeeId, selectedEmployeeIds],
  );

  const dates = useMemo(
    () => expandDateRange(startDate, endDate),
    [startDate, endDate],
  );

  const selectedReason = adjustmentReasons.find(
    (r) => String(r.id) === String(adjustmentReasonId),
  );
  const selectedType = attendanceTypes.find(
    (t) => String(t.id) === String(attendanceTypeId),
  );
  const forceFullDay = isFullDayType(selectedType);

  // On My/Team Attendance this wizard is a DECLARING tool -- trips, company
  // events, training -- so whole-day types sort to the top where they are the
  // everyday choice. HR's own copy keeps the plain alphabetical order, since
  // its job is mass correction across every type.
  const orderedAttendanceTypes = useMemo(() => {
    if (scope === "hr") return attendanceTypes;
    return [...attendanceTypes].sort(
      (a, b) => Number(isFullDayType(b)) - Number(isFullDayType(a)),
    );
  }, [attendanceTypes, scope]);

  function reset() {
    setStep(isSelfScope ? "details" : "employees");
    setSelectedEmployeeIds([]);
    setStartDate("");
    setEndDate("");
    setPrefillRows([]);
    setDateSelections({});
    setAttendanceTypeId("");
    setAdjustmentReasonId("");
    setNotes("");
    setAllowLeaveConflict(false);
    setPreview(null);
    setResult(null);
    setErrorMessage("");
    setErrorDetails([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Prefill whenever the (employees x dates) selection changes. This is what
  // supplies each employee's own shift end time and flags the dates that
  // shouldn't be swept in blindly.
  useEffect(() => {
    let cancelled = false;

    if (!employeeIds.length || !dates.length) {
      setPrefillRows([]);
      return undefined;
    }

    setPrefillLoading(true);
    fetchAttendanceBackfillPrefill({ employeeIds, dates })
      .then((rows) => {
        if (cancelled) return;
        setPrefillRows(rows);
        // Seed each date's tick state from what the prefill says about it.
        // Only dates the user hasn't already touched are (re)seeded.
        setDateSelections((prev) => {
          const next = { ...prev };
          for (const date of dates) {
            if (next[date]) continue;
            const rowsForDate = rows.filter((r) => r.work_date === date);
            next[date] = {
              selected: shouldPreselectDate(rowsForDate),
              shape: "full",
            };
          }
          return next;
        });
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
  }, [employeeIds, dates]);

  // Per-date context, collapsed across the selected employees. A date is
  // labelled a weekend/holiday if it is one for anyone (it is a calendar fact,
  // identical for everyone); "already has attendance" is reported as a count,
  // since it genuinely can differ per person.
  const dateContext = useMemo(() => {
    const map = {};
    for (const date of dates) {
      const rows = prefillRows.filter((r) => r.work_date === date);
      map[date] = {
        isWeekend: rows.some((r) => r.is_weekend),
        isPublicHoliday: rows.some((r) => r.is_public_holiday),
        holidayName: rows.find((r) => r.public_holiday_name)?.public_holiday_name,
        onLeaveCount: rows.filter((r) => r.is_on_leave).length,
        hasAttendanceCount: rows.filter((r) => r.has_existing_attendance).length,
        employeeCount: rows.length,
        // No prefill row at all means this date isn't in
        // unified_daily_attendance's spine: no company-wide activity, and not
        // a weekend or public holiday. Writing attendance here pulls the date
        // into the spine, which generates a row for EVERY active employee on
        // that date -- all of them flagged Absent. Worth saying out loud.
        notInSpine: rows.length === 0,
      };
    }
    return map;
  }, [dates, prefillRows]);

  /**
   * The times a given date will use, and whether they vary across the selected
   * employees.
   *
   * Resolution order: an explicit user override wins; otherwise each employee
   * falls back to their OWN work location's defaults. That per-employee
   * fallback is load-bearing -- forcing one pair on everyone would hand Meru
   * employees KL's 17:00 and manufacture 0.5h of phantom overtime for every one
   * of them, the exact bug the 08:30 default exists to prevent. When the
   * selection spans more than one shift end there is no single honest value to
   * display, so the row says "per employee" rather than implying otherwise.
   */
  function resolveRowTimes(date) {
    const selection = dateSelections[date] || {};
    const shape = forceFullDay ? "full" : selection.shape || "full";
    const rowsForDate = prefillRows.filter((r) => r.work_date === date);

    const distinctShiftEnds = new Set(
      rowsForDate.map((r) => r.shift_end_time).filter(Boolean),
    );
    const representative = defaultTimesForShape(
      shape,
      rowsForDate[0]?.shift_end_time,
    );

    return {
      clockIn: selection.clockIn ?? representative.clockIn,
      clockOut: selection.clockOut ?? representative.clockOut,
      perEmployee:
        distinctShiftEnds.size > 1 &&
        selection.clockOut == null &&
        shape !== "am_half",
    };
  }

  // Build the RPC payload: one row per (selected employee, ticked date).
  const payloadRows = useMemo(() => {
    const rows = [];
    for (const date of dates) {
      const selection = dateSelections[date];
      if (!selection?.selected) continue;
      const shape = forceFullDay ? "full" : selection.shape;

      for (const employeeId of employeeIds) {
        const prefill = prefillRows.find(
          (r) => r.work_date === date && r.employee_id === employeeId,
        );
        const perEmployeeDefaults = defaultTimesForShape(
          shape,
          prefill?.shift_end_time,
        );

        // Precedence: explicit override > a real scan on that side of the day
        // > this employee's own shape default. The scan case matters most --
        // a "forgot to tap out" fix must not overwrite a genuine 08:33 arrival
        // with a synthetic 08:30 and assert a time nobody observed.
        const clockIn =
          selection.clockIn ??
          (prefill?.hw_check_in
            ? String(prefill.hw_check_in).slice(11, 16)
            : perEmployeeDefaults.clockIn);
        const clockOut =
          selection.clockOut ??
          (prefill?.hw_check_out
            ? String(prefill.hw_check_out).slice(11, 16)
            : perEmployeeDefaults.clockOut);

        rows.push({
          employee_id: employeeId,
          work_date: date,
          // A whole-day type sends the shape only; the server derives the
          // times from each employee's work location and ignores any sent.
          day_shape: shape,
          clock_in_time: forceFullDay ? null : clockIn,
          clock_out_time: forceFullDay ? null : clockOut,
          attendance_type_id: String(attendanceTypeId),
          adjustment_reason_id: String(adjustmentReasonId),
          notes: notes || null,
        });
      }
    }
    return rows;
  }, [
    dates,
    dateSelections,
    employeeIds,
    prefillRows,
    attendanceTypeId,
    adjustmentReasonId,
    notes,
    forceFullDay,
  ]);

  function handleRpcError(err) {
    const { message, details } = parseRpcErrorDetails(
      err,
      "Could not add attendance records.",
    );
    setErrorMessage(message);
    setErrorDetails(details);
    setStep("error");
  }

  async function handlePreview() {
    try {
      const data = await runPreview({
        rows: payloadRows,
        allowLeaveConflict,
      });
      setPreview(data);
      setStep("preview");
    } catch (err) {
      handleRpcError(err);
    }
  }

  async function handleCommit() {
    try {
      const data = await runCommit({ rows: payloadRows, allowLeaveConflict });
      setResult(data);
      setStep("result");
    } catch (err) {
      handleRpcError(err);
    }
  }

  const selectedDateCount = dates.filter(
    (d) => dateSelections[d]?.selected,
  ).length;

  const canLeaveDates = selectedDateCount > 0 && !prefillLoading;
  const canLeaveDetails =
    attendanceTypeId &&
    adjustmentReasonId &&
    (!selectedReason?.requires_notes || notes.trim());

  if (!open) return null;

  return (
    <DataSidebar
      title={scope === "hr" ? "Backfill Attendance" : "Add Attendance"}
      open={open}
      onClose={handleClose}
      isEditing={false}
      fullPage
    >
      <div className="attendanceBackfillWizard">
        {/* ---------------- STEP 1: EMPLOYEES ---------------- */}
        {step === "employees" && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <p className="textRegular textXS">
              Choose who these attendance records are for.
              {scope === "team" && " You can select your direct reports."}
            </p>

            <EmployeeMultiSelectEditor
              value={selectedEmployeeIds}
              onChange={setSelectedEmployeeIds}
              options={employeeOptions}
              placeholder="Add employees..."
            />

            <div className="csvImportActions">
              <Button
                name="Next"
                icon2={CaretRightIcon}
                style="button buttonType2"
                onClick={() => setStep("details")}
                disabled={selectedEmployeeIds.length === 0}
              />
            </div>
          </CardLayout>
        )}

        {/* ---------------- STEP 2: DATES ---------------- */}
        {step === "dates" && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <p className="textRegular textXS">
              Pick the date range, then confirm which days to record. Weekends,
              public holidays, full-day leave, and days that already have
              attendance start unticked.
            </p>

            <div className="backfillDateRange">
              <label className="textRegular textXXS">
                From
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateSelections({});
                  }}
                />
              </label>
              <label className="textRegular textXXS">
                To
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateSelections({});
                  }}
                />
              </label>
            </div>

            {prefillLoading ? (
              <LoadingIcon />
            ) : (
              dates.length > 0 && (
                <div className="backfillDateList">
                  {dates.map((date) => {
                    const ctx = dateContext[date] || {};
                    const selection = dateSelections[date] || {};
                    const rowTimes = resolveRowTimes(date);
                    return (
                      <div key={date} className="backfillDateRow">
                        <label className="backfillDateLabel">
                          <input
                            type="checkbox"
                            checked={!!selection.selected}
                            onChange={(e) =>
                              setDateSelections((prev) => ({
                                ...prev,
                                [date]: {
                                  ...prev[date],
                                  selected: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span className="textRegular textXXS">
                            {formatDateLabel(date)}
                          </span>
                        </label>

                        <div className="backfillDateTags">
                          {ctx.isWeekend && (
                            <span className="backfillTag grey">Weekend</span>
                          )}
                          {ctx.isPublicHoliday && (
                            <span className="backfillTag blue">
                              {ctx.holidayName || "Public Holiday"}
                            </span>
                          )}
                          {ctx.onLeaveCount > 0 && (
                            <span className="backfillTag purple">
                              On leave ({ctx.onLeaveCount})
                            </span>
                          )}
                          {ctx.hasAttendanceCount > 0 && (
                            <span className="backfillTag yellow">
                              Has attendance ({ctx.hasAttendanceCount})
                            </span>
                          )}
                          {ctx.notInSpine && (
                            <span className="backfillTag red">
                              Not in attendance calendar
                            </span>
                          )}
                          {date > todayDateString() && (
                            <span className="backfillTag blue">Future</span>
                          )}
                        </div>

                        {/* The shape selector shows for EVERY type, including
                            whole-day ones -- a trip can still be a half day.
                            Only the raw time inputs are type-dependent. */}
                        <select
                          className="backfillShapeSelect"
                          value={selection.shape || "full"}
                          disabled={!selection.selected}
                          onChange={(e) =>
                            setDateSelections((prev) => ({
                              ...prev,
                              [date]: {
                                ...prev[date],
                                shape: e.target.value,
                                // Drop any manual override so the new shape's
                                // defaults apply. Without this, changing the
                                // shape would appear to do nothing on a row
                                // whose times had been edited.
                                clockIn: null,
                                clockOut: null,
                              },
                            }))
                          }
                        >
                          {DAY_SHAPES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        {/* Editable times, for timed types only. Seeded from
                            the shape (or from a real scan), and overridable --
                            a day that genuinely ran 07:00-19:00 has to be
                            recordable. Hidden entirely for a whole-day type,
                            where the server derives them. */}
                        {!forceFullDay && (
                          <div className="backfillDateTimes">
                            <input
                              type="time"
                              className="backfillTimeInput"
                              disabled={!selection.selected}
                              value={rowTimes.clockIn || ""}
                              onChange={(e) =>
                                setDateSelections((prev) => ({
                                  ...prev,
                                  [date]: {
                                    ...prev[date],
                                    clockIn: e.target.value,
                                  },
                                }))
                              }
                            />
                            <span className="textLight textXXS">–</span>
                            <input
                              type="time"
                              className="backfillTimeInput"
                              disabled={!selection.selected}
                              value={rowTimes.clockOut || ""}
                              onChange={(e) =>
                                setDateSelections((prev) => ({
                                  ...prev,
                                  [date]: {
                                    ...prev[date],
                                    clockOut: e.target.value,
                                  },
                                }))
                              }
                            />
                            {rowTimes.perEmployee && (
                              <span className="backfillTag grey">
                                per employee
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Leave conflicts are decided HERE, not on the details step --
                this is where the "On leave (N)" chips are actually on screen. */}
            <label className="backfillCheckboxRow">
              <input
                type="checkbox"
                checked={allowLeaveConflict}
                onChange={(e) => setAllowLeaveConflict(e.target.checked)}
              />
              <span className="textRegular textXXS">
                Record even on days with a full day of leave already logged
                (this will raise a leave/attendance conflict for review)
              </span>
            </label>

            <div className="csvImportActions">
              <Button
                name="Back"
                icon={CaretLeftIcon}
                style="button buttonType4"
                onClick={() => setStep("details")}
              />
              <Button
                name="Preview"
                icon2={CaretRightIcon}
                style="button buttonType2"
                onClick={handlePreview}
                disabled={!canLeaveDates || previewing}
              />
            </div>
          </CardLayout>
        )}

        {/* ---------------- STEP 3: DETAILS ---------------- */}
        {step === "details" && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <p className="textBold textXS">Attendance Type</p>
            <SelectEditor
              value={attendanceTypeId}
              onChange={setAttendanceTypeId}
              options={orderedAttendanceTypes.map((t) => ({
                label: t.name,
                value: t.id,
              }))}
              placeholder="What kind of work was this?"
            />
            {forceFullDay && (
              <p className="textLight textXXS">
                {selectedType?.name} is recorded as whole days -- the allowance
                is a flat daily entitlement, not an hourly one. Choose a full or
                half day; the clock times are set from each employee&apos;s work
                location.
              </p>
            )}

            <p className="textBold textXS">Reason</p>
            <SelectEditor
              value={adjustmentReasonId}
              onChange={setAdjustmentReasonId}
              options={adjustmentReasons.map((r) => ({
                label: r.label,
                value: r.id,
              }))}
              placeholder="Why is this being entered by hand?"
            />
            {selectedReason && (
              <p className="textLight textXXS">{selectedReason.description}</p>
            )}

            <p className="textBold textXS">
              Notes{selectedReason?.requires_notes ? " (required)" : ""}
            </p>
            <TextareaEditor value={notes} onChange={setNotes} />

            <div className="csvImportActions">
              {!isSelfScope && (
                <Button
                  name="Back"
                  icon={CaretLeftIcon}
                  style="button buttonType4"
                  onClick={() => setStep("employees")}
                />
              )}
              <Button
                name="Next"
                icon2={CaretRightIcon}
                style="button buttonType2"
                onClick={() => setStep("dates")}
                disabled={!canLeaveDetails}
              />
            </div>
          </CardLayout>
        )}

        {/* ---------------- STEP 4: PREVIEW ---------------- */}
        {step === "preview" && preview && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <div className="csvImportStatRow">
              <StatTile label="Would Add" value={preview.wouldAddCount} emphasize />
              <StatTile label="Would Skip" value={preview.wouldSkipCount} />
              <StatTile label="Total Hours" value={preview.totalHours} />
            </div>

            <BackfillRowsTable rows={preview.rows} />

            <div className="csvImportActions">
              <Button
                name="Back"
                icon={CaretLeftIcon}
                style="button buttonType4"
                onClick={() => setStep("dates")}
              />
              <Button
                name={`Add ${preview.wouldAddCount} Record${preview.wouldAddCount === 1 ? "" : "s"}`}
                icon2={CheckCircleIcon}
                style="button buttonType2"
                onClick={handleCommit}
                disabled={committing || preview.wouldAddCount === 0}
              />
            </div>
          </CardLayout>
        )}

        {/* ---------------- STEP 5: RESULT ---------------- */}
        {step === "result" && result && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <div className="csvImportBanner csvImportBannerSuccess">
              <CheckCircleIcon size={20} weight="fill" />
              <p className="textRegular textXS">
                {result.addedCount} attendance record
                {result.addedCount === 1 ? "" : "s"} added
                {result.skippedCount > 0
                  ? `, ${result.skippedCount} skipped`
                  : ""}
                .
              </p>
            </div>

            {/* Backfilling a previously-absent day rewrites figures that have
                already been reported -- attendance rate, absenteeism, the Top
                Absenteeism leaderboard and any payroll summary for that
                period. Better said plainly than discovered later. */}
            {result.addedCount > 0 && (
              <div className="csvImportBanner csvImportBannerWarning">
                <WarningIcon size={20} weight="fill" />
                <p className="textRegular textXS">
                  Attendance figures for the affected dates have changed,
                  including any period already reported to payroll.
                </p>
              </div>
            )}

            <BackfillRowsTable rows={result.rows} />

            <div className="csvImportActions">
              <Button
                name="Done"
                style="button buttonType2"
                onClick={handleClose}
              />
            </div>
          </CardLayout>
        )}

        {/* ---------------- ERROR ---------------- */}
        {step === "error" && (
          <CardLayout style="cardLayout1 cardGapSmall">
            <div className="csvImportBanner csvImportBannerError">
              <XCircleIcon size={20} weight="fill" />
              <p className="textRegular textXS">{errorMessage}</p>
            </div>

            {errorDetails.length > 0 && (
              <DataTable
                data={errorDetails}
                rowKey="src_ordinal"
                columns={[
                  {
                    key: "work_date",
                    label: "Date",
                    getValue: (r) => r.work_date,
                  },
                  {
                    key: "clock_in_time",
                    label: "In",
                    getValue: (r) => r.clock_in_time,
                  },
                  {
                    key: "clock_out_time",
                    label: "Out",
                    getValue: (r) => r.clock_out_time,
                  },
                  { key: "reason", label: "Reason", getValue: (r) => r.reason },
                ]}
              />
            )}

            <div className="csvImportActions">
              <Button
                name="Try Again"
                icon2={ArrowClockwiseIcon}
                style="button buttonType4"
                onClick={reset}
              />
            </div>
          </CardLayout>
        )}
      </div>
    </DataSidebar>
  );
}

function BackfillRowsTable({ rows }) {
  if (!rows?.length) return null;

  return (
    <DataTable
      data={rows.map((r, i) => ({ ...r, _key: `${r.employeeId}-${r.workDate}-${i}` }))}
      rowKey="_key"
      columns={[
        { key: "fullName", label: "Employee", getValue: (r) => r.fullName },
        { key: "workDate", label: "Date", getValue: (r) => r.workDate },
        {
          key: "times",
          label: "Times",
          getValue: (r) =>
            `${String(r.clockInAt).slice(11, 16)} - ${String(r.clockOutAt).slice(11, 16)}`,
        },
        { key: "hours", label: "Hours", getValue: (r) => r.hours },
        {
          key: "attendanceTypeName",
          label: "Type",
          getValue: (r) => r.attendanceTypeName,
        },
        {
          key: "action",
          label: "Action",
          getValue: (r) => (r.action === "add" ? "Add" : "Skip"),
        },
        {
          key: "reason",
          label: "Note",
          getValue: (r) =>
            [r.reason, ...(r.warnings || [])]
              .filter(Boolean)
              .join(", ")
              .replaceAll("_", " ") || "—",
        },
      ]}
    />
  );
}
