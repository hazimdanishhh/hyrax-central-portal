# Attendance Self-Service Architecture

Employees previously had no way to see their own current attendance status, and no visibility into two real automatic mechanisms that affect them (a biometric scan silently ending an open remote session, and a scheduled end-of-day auto-clock-out). This doc covers the frontend widgets, the notification rules, and the data-correctness fixes built to close that gap. For the existing HR/Team/My Attendance CRUD pages themselves (list/overview pages, RPCs), see `DEPARTMENT-PAGES-TABLES.md` and `RPC-REFERENCE.md`; for the notification system's own generic architecture (event log, rules, fan-out), see `NOTIFICATIONS-ARCHITECTURE.md`.

## The policy this is all built around

**Office and Blending Plant are scanner-only. The app's clock-in form is remote-only** (Site Visit, Work From Home, Business Meeting, Training, Overtime). These are mutually exclusive by design — you're either physically badged in at a company site, or clocked in remote via the app, never represented as both at once for the same moment. This matters for every design decision below.

## "Current activity" — why `employees_public.current_status`, not `unified_daily_attendance.daily_activities`

`unified_daily_attendance.daily_activities` (a `STRING_AGG` of that day's `attendance_activities` rows) is populated **exclusively** from app clock-ins. Given the policy above, it can never represent a scanner-based "Office"/"Blending Plant" day — an on-site-only day always has an empty `daily_activities`, which is why an early version of the Dashboard card showed nothing for on-site employees.

`employees_public.current_status` (`supabase/sql_editor/employees_public_view.sql`) already solves this: a real-time `CASE` that returns whichever of {an open app session, the most recent biometric scan, an approved leave entry} happened most recently today —

- an **open** app session more recent than the last scan → the attendance type's name (e.g. "Site Visit")
- a **closed** app session that's the most recent event → `'Offline'`
- the most recent event is a scan → `scanner_location` verbatim (e.g. `"Office"`, `"Blending Plant"`)
- nothing today at all, but an approved leave entry exists → `'On Leave (<code>)'`
- otherwise → `'Offline / Not Arrived'`

Every string this produces already matches an exact key in `src/components/attendance/attendanceType/AttendanceType.jsx`'s config map, so it renders with the correct icon/color with zero new styling work. `unified_daily_attendance.hr_flag` is kept as a *secondary* anomaly badge alongside it (Pending App Approval / Missing App Check-Out / Incomplete Card Scans / Absent / OK / Approved / Weekend), since `current_status` carries no approval-state information.

## Frontend

- **`src/features/employee/attendance/private/hooks/useMyCurrentStatus.js`** — wraps the pre-existing `fetchEmployeePublicById` (`src/features/hr/employees/public/api/employeePublic.js`) in a `useQuery` (`refetchOnWindowFocus: true`, overriding the app-wide default — this view is a live snapshot). Shared by both consumers below so nav and dashboard never disagree.
- **`src/features/employee/attendance/private/hooks/useMyAttendanceThisWeek.js`** — a narrow query against `unified_daily_attendance` for the current employee, Monday-through-today. Supplies both today's row (`hr_flag`, `first_in`/`last_out`, `daily_activities`, `is_on_leave`) and the week's `hours_worked` series for the chart.
- **`src/components/attendance/todayAttendanceCard/TodayAttendanceCard.jsx`** — the Dashboard home page card. Shows the `current_status` pill, the `hr_flag` anomaly badge, a first-in/last-seen completion bar, a horizontal-bar chart of hours worked this week, and the clock-in/out action. When there's an open remote session, a live "Xh Ym" elapsed-time counter (`src/functions/useElapsedSince.js`) is shown instead of relying on `last_status_time` — that field freezes at the clock-in moment for as long as a session stays open (it only moves again on the next real event), so it would otherwise look stale for the whole session.
- **`src/components/attendanceActivityClockin/clockinMini/ClockinMini.jsx`** — the sidenav/mobile-nav mini widget. Shows the same `current_status` pill (via the same shared hook) when there's no open app session; an open session still takes precedence, since it's the most authoritative "right now" signal.
- **`src/features/employee/attendance/private/hooks/useClockInOutAction.js`** — the shared clock-in/out wiring (sidebar state, mutation calls, query invalidation for both `my_attendance_this_week` and `my_current_status`) used by both components above, so a clock-in/out from either surface updates both immediately.

## Notification rules

All three follow the existing generic event-driven system unchanged (`notification_events` → `notification_rules` → `notifications`/`email_queue`, see `NOTIFICATIONS-ARCHITECTURE.md`). Recipients for all three are the employee themselves, resolved via `target_payload_keys: ['employee_profile_id']`.

| Event type | Shape | Files |
| --- | --- | --- |
| `attendance.clocked_in_remote` | Change-triggered, `AFTER INSERT ON attendance_activities` | `supabase/functions/notify_attendance_clocked_in.sql`, `supabase/triggers/trg_notify_attendance_clocked_in.sql` |
| `attendance.autoclockout_approaching` | Scheduled-scan, two cutoffs, one-shot per cutoff | `supabase/functions/check_attendance_autoclockout_approaching_evening.sql`, `..._midnight.sql`, `supabase/sql_editor/attendance_activities_add_autoclockout_warning_columns.sql`, `supabase/sql_editor/schedule_check_attendance_autoclockout_approaching_cron.sql` |
| `attendance.clocked_out_remote` | Change-triggered, `AFTER UPDATE ON attendance_activities WHEN (OLD.clocked_out_at IS NULL AND NEW.clocked_out_at IS NOT NULL)` | `supabase/functions/notify_attendance_clocked_out.sql`, `supabase/triggers/trg_notify_attendance_clocked_out.sql` |

Seed rules: `supabase/sql_editor/seed_attendance_autoclockout_notification_rules.sql` (the first two events), `supabase/sql_editor/seed_attendance_clocked_out_notification_rule.sql` (the third, seeded separately since the first file had already been executed by the time the third event was added — re-running it would have duplicated its two rows).

### The two real auto-clock-out cutoffs

`auto_clock_out()` (`supabase/functions/auto_clock_out.sql`) force-closes any still-open remote `attendance_activities` row. It's scheduled **twice daily** against two live `pg_cron` jobs — around **5:00 PM MYT** and **11:59 PM MYT** — both calling this same function. As with the older of the two (per `NOTIFICATIONS-ARCHITECTURE.md`'s own note on `auto-clock-out.ts`), **neither cron schedule is captured anywhere in this repo** — both were set up directly in the Supabase dashboard. `attendance.autoclockout_approaching`'s two scan functions are timed ~15 minutes ahead of each (16:45 / 23:44 MYT) to warn anyone still open before it happens.

### `attendance.clocked_out_remote` covers all three closure paths with one trigger

Every code path that ends a remote session — the employee's own manual clock-out (`clockOutAttendanceActivity`), a scanner badge auto-closing it (`auto_clock_out_app_on_scan()`), and the two cutoffs above (`auto_clock_out()`) — already converges on the same `UPDATE attendance_activities SET clocked_out_at = ...`. Rather than three separate `emit_notification_event()` call-sites, one trigger on that transition covers all three, with a best-effort reason inferred from data already on hand (no new columns, no cross-function signaling):

- an exact `clocked_out_at` = `attendance_logs.scanned_at` match for that employee → scanner-caused, names the location
- `clocked_out_at`'s local time-of-day falls in a narrow window around 17:00 or 23:59 MYT → cutoff-caused
- otherwise → manual

## Scanner race-condition guard (`auto_clock_out_app_on_scan()`)

`vigilance_iot` ingests scans in ~5-minute batches (per `CRON_SCHEDULE`, both scanner locations), so a scan's real timestamp can differ meaningfully from when its `attendance_logs` row actually lands. The pre-existing trigger (`supabase/triggers/trigger_auto_clock_out.sql`) had no guard against this at all — it closed *any* currently-open session the moment *any* new scan landed, with no check on timing. Two guards were added to its `UPDATE`'s `WHERE` clause:

- **Ordering** (`clocked_in_at <= NEW.scanned_at`): a scan whose real timestamp precedes the session's own clock-in can no longer close it — prevents a delayed/out-of-order scan from producing a negative-duration row.
- **Minimum gap** (`NEW.scanned_at >= clocked_in_at + interval '5 minutes'`): matches the ~5-minute ingestion cadence — a scan landing within 5 minutes of the clock-in is too close/ambiguous to confidently mean "arrived on-site instead," so it's ignored and the session stays open. The next real scan or the end-of-day cutoff still closes it eventually.

## `hours_worked` — multi-segment scanner day fix

`unified_daily_attendance`'s hardware-hours figure (`hw_hours`) was a naive `MAX(scanned_at) - MIN(scanned_at)` span across every scan that day — correct for a simple one-visit day, but silently counting any away-gap (a remote stint, even a long lunch) as on-site time. Since `app_hours` separately, correctly counts that same remote gap, the total (`hw_hours + app_hours`) double-counted it on any office→remote→office (or office→remote→blending-plant, etc.) day.

**Rejected fix: pairing scans by position (1st↔2nd as in/out, and so on).** This looked like the obvious fix, but employees routinely forget to scan in or out in practice — a single missed scan shifts the odd/even parity for every scan later that day, silently mispairing the rest and producing worse, harder-to-notice errors than the original bug. This would only be safe with strict, hardware-enforced alternation (impossible to scan "in" twice without an "out" between), which isn't realistic given how attendance actually gets used.

**Actual fix**: keep the naive day-span, but subtract whatever portion of it overlaps with a real, independently-tracked remote session (`attendance_activities` — unambiguous start/end times, nothing to "forget" the direction of). This only needs each day's *outer* scan bounds, so it's immune to any number of missed or extra scans in between, and is location-agnostic (the hardware span already merges every scanner location, so an office→blending-plant→office day is handled identically to a single-location day). New CTE `daily_hw_remote_overlap` in `supabase/sql_editor/hr_unified_daily_attendance_view.sql`; `hours_worked` becomes `GREATEST(0, hw_hours - overlap_hours) + app_hours`.

**What this still doesn't fix, deliberately**: a travel/absence gap with *no* corroborating `attendance_activities` row at all (a pure lunch break, or physically moving between two on-site locations with nothing logged in between) is still counted as on-site time, unchanged from before. This is a separate problem from the one reported, and isn't solvable by a calculation change — it needs a real per-scan in/out type at the hardware level, which the scanner doesn't currently provide.
