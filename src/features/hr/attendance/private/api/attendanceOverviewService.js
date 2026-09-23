// features/hr/attendance/private/api/attendanceOverviewService.js

import { supabase } from "../../../../../lib/supabaseClient";
import { formatDate, formatDateTime, formatTime } from "@/functions/formatDate";

/**
 * Unified Daily Attendance View -- one calendar day's roster in one shot.
 * Source: unified_daily_attendance
 *
 * Deliberately NOT row-paginated: the view is one row per active employee
 * per day, so a single day is already naturally bounded by active headcount
 * (see employment_status_category_migration.sql -- the view's own
 * expected_shifts CTE now filters to active-bucket employees). The previous
 * version of this function used OFFSET/LIMIT page-of-100 pagination, which
 * silently split a single day's roster across two "pages" the moment active
 * headcount neared/exceeded 100. Callers now page by `date`
 * (see useAttendanceDailyList), not by row offset.
 */
export async function fetchUnifiedAttendance({ date, search, filters, sortBy, sortOrder }) {
  let query = supabase
    .from("unified_daily_attendance")
    .select("*")
    .eq("work_date", date);

  query = applyAttendanceSort(
    query,
    sortBy || "full_name",
    sortOrder !== "descending",
  );

  // -------------------
  // SEARCH
  // -------------------

  if (search) {
    query = query.or(
      [
        `full_name.ilike.%${search}%`,
        `company_employee_code.ilike.%${search}%`,
        `department_name.ilike.%${search}%`,
      ].join(","),
    );
  }

  // -------------------
  // FILTERS
  // -------------------
  // Only columns that actually exist on unified_daily_attendance -- verified
  // against hr_unified_daily_attendance_view.sql's SELECT list. "attendanceType"
  // (app_attendance_type) and "approvalStatus" (app_approval_status) used to be
  // handled here but those columns don't exist on this view (a leftover from
  // the old per-activity `attendance_activities` model this page used to
  // query) -- hr_flag already captures approval/anomaly state, e.g.
  // "Pending App Approval".

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;

    query = applyAttendanceFilter(query, key, value);
  });

  const { data, error } = await query;

  if (error) throw error;

  return {
    data: normalizeUnifiedAttendance(data || []),
    totalCount: data?.length || 0,
  };
}

// Shared by both fetchers below -- builds the FULL multi-column .order()
// chain for whichever single field the SortBar UI's dropdown chose, rather
// than sorting by just that one column. The chosen ascending/descending
// toggle applies ONLY to that primary column; two fixed tie-breaks are
// then appended in this order (skipping either one that IS already the
// primary column, to avoid ordering by the same column twice):
//   1. full_name ascending -- a human-friendly, deterministic secondary
//      order. Also what makes Search mode's row-offset pagination stable
//      across pages (see fetchUnifiedAttendanceSearch's own comment).
//   2. work_date descending -- most recent day first. A no-op in Day mode
//      (every row already shares one date -- see fetchUnifiedAttendance's
//      own comment), genuinely meaningful in Search mode (rows span many
//      dates).
// These two tie-break directions are fixed, not user-configurable --
// flipping "sort by Department" to descending should reverse department
// order, not also flip "most recent date first" to oldest-first; the two
// concerns are independent. The user asked for exactly this shape for two
// concrete cases (Employee Name -> secondary date descending; Department ->
// name then date) -- generalized here to every sort option (Hours Worked,
// Status, First In, Last Out too) rather than special-casing just those
// two, since the same "name, then most-recent-date" tie-break reads
// sensibly regardless of the primary column chosen.
//
// Final tie-break: employee_uuid, always, unconditionally (it's never a
// sort option a user can pick, so no skip-check needed). Two employees can
// share the same full_name -- without this, their rows for the same date
// would have no deterministic relative order, which would let Search
// mode's row-offset pagination silently show a row twice or skip one
// across a page boundary.
function applyAttendanceSort(query, primaryColumn, primaryAscending) {
  let q = query.order(primaryColumn, { ascending: primaryAscending });

  if (primaryColumn !== "full_name") {
    q = q.order("full_name", { ascending: true });
  }
  if (primaryColumn !== "work_date") {
    q = q.order("work_date", { ascending: false });
  }

  return q.order("employee_uuid", { ascending: true });
}

// Shared by both fetchers below -- named business-window filters mirroring
// get_attendance_dashboard_rpc.sql's own thresholds exactly (09:00 late
// arrival; overtime and early leave read from unified_daily_attendance's
// overtime_hours/is_early_leave columns -- beyond 8 paid hours per day and
// before the work location's cutoff, respectively), so a drill-through
// link's row count always matches the KPI it came from.
function applyAttendanceFilter(query, key, value) {
  switch (key) {
    case "employee":
      return query.eq("employee_uuid", value);

    case "department":
      return query.eq("department_id", value);

    case "workLocation":
      return query.eq("work_location_id", value);

    case "manager":
      return query.eq("manager_id", value);

    // ---------------------------------------------------------------------
    // AXIS FILTERS -- the replacement for hrFlag/dayType below.
    //
    // Each maps to exactly one column and answers exactly one question, which
    // is the whole point: hr_flag had to pick a single winner between
    // "what kind of day", "how complete is the evidence" and "was it
    // approved", so asking about one of them meant losing the other two.
    // These compose -- day_state='worked' AND approval_state='pending' AND
    // evidence_quality='single_scan' is now an expressible query.
    //
    // Values come from functions/attendanceDayState.js, which is verified
    // against the view's own CASE expressions. A value that is not a real
    // column value returns zero rows with no error, so do not hand-write them.
    // ---------------------------------------------------------------------
    case "dayState":
      return query.eq("day_state", value);

    case "evidenceQuality":
      return query.eq("evidence_quality", value);

    case "approvalState":
      return query.eq("approval_state", value);

    case "evidenceSource":
      return query.eq("evidence_source", value);

    case "leaveState":
      return query.eq("leave_state", value);

    // Supersedes dayType below -- that was a two-valued working/weekend
    // toggle over is_weekend, which could not express "public holiday" at all,
    // nor the weekend-that-is-also-a-holiday overlap (a real case that
    // contributes to BOTH statutory wage tiers).
    case "calendarType":
      return query.eq("day_calendar_type", value);

    // ---------------------------------------------------------------------
    // LEGACY URL PARAMS. The hr_flag COLUMN no longer exists -- these two
    // cases translate the old query-string values onto the axis columns.
    //
    // They cannot simply be deleted. Notification emails and in-app links
    // generated before the migration carry `hrFlag=Absent&dayType=working`,
    // and those live in people's inboxes indefinitely. Without a case here
    // they would fall through to `default: return query` -- no filter applied
    // at all -- so the page would show EVERY row instead of the absences the
    // link promised. Silently wrong, with no error to notice.
    //
    // The mapping is necessarily lossy in one direction: hr_flag conflated
    // four questions, so 'OK' and 'Approved' both really meant "an ordinary
    // day that was worked", and the distinction they appeared to draw
    // (hardware-only vs app-approved) is now evidence_source/approval_state.
    // Both therefore map to day_state = 'worked', which is what each of them
    // actually meant.
    //
    // Delete these once old links have aged out -- they read nothing from the
    // database that would break first, so there is no forcing function. A
    // year is a reasonable horizon.
    case "hrFlag":
      switch (value) {
        case "Absent":
          return query.eq("day_state", "absent");
        case "Pending App Approval":
          return query.eq("approval_state", "pending");
        case "Missing App Check-Out":
          return query.eq("evidence_quality", "open_session");
        case "Incomplete Card Scans":
          return query.eq("evidence_quality", "single_scan");
        case "OK":
        case "Approved":
          return query.eq("day_state", "worked");
        default:
          // An unrecognised legacy value -- including the dynamic
          // 'On Leave (AL)' / 'Public Holiday (<name>)' forms, which were
          // never valid filter values anyway since they embedded data.
          // Returning the query unfiltered would silently show everything,
          // so match nothing instead: an empty list is an honest answer to
          // a filter we cannot honour.
          return query.eq("day_state", "__unmapped_legacy_hr_flag__");
      }

    // LEGACY -- superseded by calendarType, which can also express public
    // holidays and the weekend-that-is-also-a-holiday overlap. Retained for
    // the same reason as hrFlag above: existing links carry it.
    case "dayType":
      // Merged "Working Days Only"/"Weekend Only" into one filter -- they
      // were previously two separate dropdown entries that were really just
      // opposite ends of the same is_weekend boolean.
      if (value === "working") return query.eq("is_weekend", false);
      if (value === "weekend") return query.eq("is_weekend", true);
      return query;

    case "presentOnly":
      // "Present" is exactly "we have evidence this person was here", which
      // is what the evidence_source axis was built to answer.
      //
      // BROKEN UNTIL 2026-09-23: this read `hr_flag` -- `.neq("hr_flag",
      // "Absent").not("hr_flag", "ilike", "Public Holiday%")` -- and hr_flag
      // was dropped from the view in Ship 3, so every request 400'd with
      // "column does not exist" and the list failed to load entirely.
      //
      // The replacement is also simpler than what it replaces. The old
      // version needed two string tests plus a paragraph explaining why
      // is_weekend must NOT be excluded (a worked Saturday is still present)
      // and why the "Public Holiday%" prefix was safe (hr_flag only ever read
      // that on a zero-attendance day). evidence_source states the same thing
      // directly: 'none' means nothing told us they were here, anything else
      // means something did -- on any kind of calendar day.
      return query.neq("evidence_source", "none");

    case "onLeave":
      return query.eq("is_on_leave", true);

    case "overtimeOnly":
      // Overtime is hours beyond the normal 8 paid hours in a day, per
      // Employment Act s.60A (unified_daily_attendance's overtime_hours
      // column, redefined 2026-09-22 -- it previously meant "time worked
      // after 6PM"). No query change was needed for that switch: this reads
      // the column, so the view's formula swap corrected this filter
      // automatically.
      //
      // The `.eq("is_weekend", false).neq("hr_flag", "Absent")` guards that
      // used to sit here are GONE (2026-09-23). Their own comment already
      // called them "redundant-but-harmless ... kept for consistency" -- and
      // they turned out not to be harmless: hr_flag was dropped from the view
      // in Ship 3, so this filter 400'd and the list failed to load. They were
      // genuinely redundant, which is why removing rather than translating
      // them is correct: the view forces overtime_hours to 0 on weekends and
      // public holidays (those pay under their own s.60(3)/s.60D(3) tiers),
      // and a day with no attendance has no hours to exceed 8 in the first
      // place. `> 0` already implies every guard they expressed.
      return query.gt("overtime_hours", 0);

    // Both of these carried the same dead `.neq("hr_flag", "Absent")` the two
    // cases above did, and both 400'd for the same reason -- reported from the
    // Attendance Overview KPI cards, whose Late Arrivals / Early Leave tiles
    // deep-link straight into these filters.
    //
    // Dropping the extra guards rather than translating them is not a
    // shortcut: BOTH columns already bake every one of those conditions in.
    // is_late_arrival / is_early_leave are each
    // `NOT is_weekend AND no holiday AND no leave AND <threshold test>`, and
    // the threshold test needs a real first_in / last_out to compare against,
    // so a day with no attendance can never satisfy either. `= true` alone is
    // strictly equivalent to what the three-clause version meant to express.
    //
    // Keeping the guards in the view rather than restating them per consumer
    // is the same discipline these two columns were created for: they drive
    // the card badge, the day sidebar, the dashboard KPI and this filter, and
    // they used to disagree.
    case "lateArrival":
      return query.eq("is_late_arrival", true);

    case "earlyLeave":
      return query.eq("is_early_leave", true);

    // HR2000 leave/attendance conflict detection -- all three already
    // tightly scoped by daily_leave's leave_day_fraction_total in the view
    // itself, unlike overtimeOnly/lateArrival/earlyLeave above, so no
    // Weekend/Absent hr_flag exclusion is needed here.
    case "leaveAttendanceConflict":
      return query.eq("is_leave_attendance_conflict", true);

    // Two-valued, unlike its two neighbours, because this is the only one of
    // the three that is ACKNOWLEDGEABLE (see acknowledge_attendance_day_rpc.sql
    // -- leave conflicts and leave data errors clear themselves on the next
    // HR2000 sync instead, so raw and unresolved are the same set for them).
    //
    // "true" keeps the raw column: the filter is labelled "Half-Day Leave, <4h
    // Worked", a statement about the day, and every such day is a payroll input
    // whether or not HR has reviewed it. "unresolved" is the reconciliation
    // question, and matches what the row-flag badge shows
    // (attendanceReconciliationFlags.js reads the same unacknowledged column).
    // Before this existed, picking the filter returned a mix of badged and
    // unbadged rows with nothing to explain the difference.
    case "insufficientHalfDayHours":
      if (value === "unresolved")
        return query.eq("is_unacknowledged_insufficient_half_day", true);
      return query.eq("is_insufficient_half_day_hours", true);

    case "leaveFractionError":
      return query.eq("has_leave_fraction_error", true);

    case "publicHoliday":
      return query.eq("is_public_holiday", true);

    case "workedOnHoliday":
      return query.eq("is_worked_on_holiday", true);

    case "workedOnWeekend":
      return query.eq("is_worked_on_weekend", true);

    // The reconciliation pull-list: needs_reconciliation is computed on the
    // view itself (hr_unified_daily_attendance_view.sql), acknowledgement-
    // aware, so this is a real WHERE clause -- correct under Search mode's
    // pagination too, unlike Payroll Export's own client-side-only version
    // of this same idea (that page's rows are a period aggregate, not
    // individually filterable this way).
    case "needsReconciliation":
      return query.eq("needs_reconciliation", true);

    default:
      return query;
  }
}

/**
 * Unified Daily Attendance View -- Search mode: all dates (unless narrowed
 * by an explicit startDate/endDate), row-paginated.
 *
 * Sibling to fetchUnifiedAttendance (day mode). Used the moment any of
 * Employee/Department/Manager/Status/date-range is set, or search text is
 * typed (see AttendanceManagement.jsx's isSearchMode) -- filtering by e.g.
 * one employee should show that employee's whole history, not just their
 * one row for whatever single date happened to be selected. Row-offset
 * pagination is safe here (unlike the old pre-day-mode version of this
 * page) because applyAttendanceSort's tie-break chain (full_name, then
 * work_date) makes results deterministic across pages even when a page
 * boundary falls mid-day -- that's just an ordinary paginated list now,
 * not a bug, same as every other list page in this app.
 */
export async function fetchUnifiedAttendanceSearch({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("unified_daily_attendance")
    .select("*", { count: "exact" });

  query = applyAttendanceSort(
    query,
    sortBy || "work_date",
    sortOrder === "ascending",
  );

  // -------------------
  // SEARCH
  // -------------------

  if (search) {
    query = query.or(
      [
        `full_name.ilike.%${search}%`,
        `company_employee_code.ilike.%${search}%`,
        `department_name.ilike.%${search}%`,
      ].join(","),
    );
  }

  // -------------------
  // FILTERS
  // -------------------
  // Same cases as fetchUnifiedAttendance (via the shared applyAttendanceFilter
  // helper), plus startDate/endDate -- both optional; with neither set, this
  // is genuinely all-time.

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;

    if (key === "startDate") {
      query = query.gte("work_date", value);
    } else if (key === "endDate") {
      query = query.lte("work_date", value);
    } else {
      query = applyAttendanceFilter(query, key, value);
    }
  });

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: normalizeUnifiedAttendance(data || []),
    totalCount: count || 0,
  };
}

// Fallback fetch for a deep link to a row not on the currently loaded day/
// page (see AttendanceManagement.jsx's URL-driven sidebar) -- the row's
// "id" is normalizeUnifiedAttendance's own synthetic `${employee_uuid}_
// ${work_date}` composite (unified_daily_attendance has no single-record
// primary key of its own, since one row already aggregates a whole day's
// punches), so it's parsed back apart here. Reuses normalizeUnifiedAttendance
// so the resulting shape is byte-identical to a row already found in the
// loaded list, whether Day mode or Search mode found it first.
export async function fetchAttendanceActivityById(id) {
  if (!id) return null;

  const [employeeUuid, workDate] = id.split("_");
  if (!employeeUuid || !workDate) return null;

  const { data, error } = await supabase
    .from("unified_daily_attendance")
    .select("*")
    .eq("employee_uuid", employeeUuid)
    .eq("work_date", workDate)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeUnifiedAttendance([data])[0];
}

// FORMAT
export function normalizeUnifiedAttendance(rows) {
  return rows.map((row) => ({
    ...row,

    id: `${row.employee_uuid}_${row.work_date}`,

    work_date: formatDate(row.work_date),

    first_in: formatDateTime(row.first_in),
    first_in_time: formatTime(row.first_in),
    last_out: formatDateTime(row.last_out),
    last_out_time: formatTime(row.last_out),

    hw_check_in: formatDateTime(row.hw_check_in),
    hw_check_in_time: formatTime(row.hw_check_in),
    hw_check_out: formatDateTime(row.hw_check_out),
    hw_check_out_time: formatTime(row.hw_check_out),

    app_check_in: formatDateTime(row.app_check_in),
    app_check_in_time: formatTime(row.app_check_in),
    app_check_out: formatDateTime(row.app_check_out),
    app_check_out_time: formatTime(row.app_check_out),

    hours_worked:
      row.hours_worked !== null ? Number(row.hours_worked).toFixed(2) : null,
  }));
}

// API function for the Sidebar
export async function fetchEmployeeDayDetails(employeeUuid, workDate) {
  if (!employeeUuid || !workDate) return [];

  const { data, error } = await supabase
    .from("attendance_activity_audit")
    .select("*")
    .eq("employee_uuid", employeeUuid)
    .eq("work_date", workDate)
    .order("check_in_time", { ascending: true });

  if (error) throw error;

  return normalizeEmployeeDayDetails(data || []);
}

function normalizeEmployeeDayDetails(rows) {
  return rows.map((row) => ({
    ...row,

    check_in_time_only: formatTime(row.check_in_time),
    check_out_time_only: formatTime(row.check_out_time),
  }));
}
