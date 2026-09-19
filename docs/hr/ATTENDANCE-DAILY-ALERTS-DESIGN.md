# Attendance Daily Flag Alerts — Design (not built yet)

**Status: designed, not implemented.** HR asked for a daily 9am notification telling each employee about their own attendance flags (late arrival, missing checkout, etc.), deep-linking straight into a filtered My Attendance/Team Attendance view, with each flag getting its own notification rule. This was fully designed alongside the weekend-flag/security-invoker finalization pass (see that pass's plan and `hr_unified_daily_attendance_view.sql`'s `is_weekend` column), but the user asked to pause building it until the rest of the module is working and proven. This doc exists so the design doesn't need to be re-derived when it's picked up later — nothing in this doc has been created in the database yet (no new function, cron job, or `notification_rules` rows exist).

For the generic event log/rules/fan-out engine this builds on, see `NOTIFICATIONS-ARCHITECTURE.md`. For the closest existing analog (a scheduled scan with a cooldown, targeting a manager), see `check_attendance_approvals_pending.sql` and its own section in `ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md`.

## Flag catalog

Nine distinct flags, each independently detectable from `unified_daily_attendance` columns. Each becomes **two** event types — an employee copy and a manager copy — not one event with two recipients, because `fan_out_notification_event()` applies a single event's `title`/`message`/`link_to` to every recipient of every matching rule; the employee and their manager need genuinely different deep links (My Attendance vs. Team Attendance, the latter scoped to `?employee=<id>`), so they must be two separate `notification_events` rows. The one exception is `pending_approval_fyi`, employee-only — the manager/HR side is already fully covered by the existing `attendance.approval_pending` event, no need to duplicate it.

| Flag | Condition | Employee event_type | Manager event_type |
|---|---|---|---|
| Late arrival | `is_late_arrival` | `attendance.alert.late_arrival` | `attendance.alert.late_arrival.manager` |
| Early leave | `is_early_leave` | `attendance.alert.early_leave` | `attendance.alert.early_leave.manager` |
| Missing app check-out | `hr_flag = 'Missing App Check-Out'` | `attendance.alert.missing_checkout` | `attendance.alert.missing_checkout.manager` |
| Incomplete card scans | `hr_flag = 'Incomplete Card Scans'` | `attendance.alert.incomplete_scans` | `attendance.alert.incomplete_scans.manager` |
| Unexplained absence | `hr_flag = 'Absent' AND NOT is_weekend AND NOT is_public_holiday` | `attendance.alert.absent` | `attendance.alert.absent.manager` |
| Leave/attendance conflict | `is_leave_attendance_conflict` | `attendance.alert.leave_conflict` | `attendance.alert.leave_conflict.manager` |
| Insufficient half-day hours | `is_insufficient_half_day_hours` | `attendance.alert.insufficient_half_day` | `attendance.alert.insufficient_half_day.manager` |
| Leave fraction data error | `has_leave_fraction_error` | `attendance.alert.leave_fraction_error` | `attendance.alert.leave_fraction_error.manager` |
| Pending app approval (employee FYI) | `hr_flag = 'Pending App Approval'` | `attendance.alert.pending_approval_fyi` | *(none)* |

The unexplained-absence check adds its own `NOT is_weekend AND NOT is_public_holiday` guard rather than trusting `hr_flag = 'Absent'` alone — that string can mean "genuine unworked weekend" just as easily as a real absence now that weekend was removed from `hr_flag` (see the finalization pass), so this scan can't assume the invariant holds without checking.

## Deep links

Every link always includes `startDate=<work_date>&endDate=<work_date>` (the exact flagged day, ISO `YYYY-MM-DD`), which lands the viewer in "Search mode" rather than "Day mode" (both dates are already in every page's `SEARCH_MODE_FILTER_KEYS` array — confirmed by tracing `src/hooks/usePaginatedQuery.js` directly: it builds its filter object generically from whatever's in the URL, not from `filterConfig.js`, so **every filter key below — including the three "conflict family" ones not currently shown as chips on My/Team Attendance — already works over a deep link with zero additional frontend plumbing**). A manager's copy of the link additionally prepends `employee=<employee_uuid>` so it narrows to that one direct report, not the whole team.

| Flag | Employee link (`/app/employee/attendance/list`) | Manager link (`/app/employee/team-attendance/list`) |
|---|---|---|
| Late arrival | `?lateArrival=true&startDate={d}&endDate={d}` | `?employee={id}&lateArrival=true&startDate={d}&endDate={d}` |
| Early leave | `?earlyLeave=true&startDate={d}&endDate={d}` | same + `employee={id}` |
| Missing app check-out | `?hrFlag=Missing%20App%20Check-Out&startDate={d}&endDate={d}` | same + `employee={id}` |
| Incomplete card scans | `?hrFlag=Incomplete%20Card%20Scans&startDate={d}&endDate={d}` | same + `employee={id}` |
| Unexplained absence | `?hrFlag=Absent&startDate={d}&endDate={d}` | same + `employee={id}` |
| Leave/attendance conflict | `?leaveAttendanceConflict=true&startDate={d}&endDate={d}` | same + `employee={id}` |
| Insufficient half-day hours | `?insufficientHalfDayHours=true&startDate={d}&endDate={d}` | same + `employee={id}` |
| Leave fraction data error | `?leaveFractionError=true&startDate={d}&endDate={d}` | same + `employee={id}` |
| Pending app approval (FYI) | `?hrFlag=Pending%20App%20Approval&startDate={d}&endDate={d}` | *(n/a)* |

A useful side effect of always pairing the flag filter with the exact date: if the issue is fixed between alert-time and click-time (checkout backfilled, leave corrected), the link legitimately returns zero rows instead of misleadingly showing a now-resolved record.

**Deliberately not built into this design**: an HR-broadly cc for the data-integrity flags (leave conflict / insufficient half-day / leave fraction error), mirroring `attendance.approval_pending`'s manager+HR targeting. That event links to `/app/hr/attendance/list` (HR department, no role gate); Team Attendance is gated `AccessRoute roles={["manager"]}`, so targeting a plain HR staff member onto a `.manager` event would hit Unauthorized on click. Keeping every flag to employee+direct-manager only, uniformly, avoids that trap. An HR-facing third event per data-integrity flag, deep-linking to HR's own list, is a clean future add-on.

## Scan window

`work_date = (now() at time zone 'Asia/Kuala_Lumpur')::date - 1` — yesterday, MYT, scanned once every morning at 09:00 MYT. At 9am, today's row is still open for most employees (no `last_out`, possibly no `first_in` yet for late risers) — flagging "today" would either miss people who haven't arrived yet or need a second same-day rerun later, reintroducing the exact dedup problem the next section solves cleanly by only ever looking at a day that's fully closed out.

## Dedup

No new column on `attendance_activities` (unlike `last_reminder_sent_at`/the autoclockout warned-at columns) — several of these flags (missing-checkout, incomplete-scans, absent) frequently have no corresponding `attendance_activities` row at all to stamp a cooldown onto. Instead, check `notification_events` directly before emitting, keyed on `(event_type, entity_table = 'unified_daily_attendance', entity_id)` where `entity_id = employee_uuid::text || '_' || work_date::text` (the same synthetic-id convention the frontend's `normalizeUnifiedAttendance()` already uses client-side for its row `id`). This needs one new supporting index:

```sql
create index if not exists notification_events_event_entity_idx
    on public.notification_events (event_type, entity_id);
```

This is a one-shot existence check, not a cooldown — correct here because the scan only ever visits a given `work_date` once, the following morning. A cron rerun (manual retry, failure recovery) on the same day is exactly what this check protects against. If the underlying issue is later fixed (HR backfills a missing checkout, corrects a leave entry), there's no retraction of an alert already sent, but also no re-alert — the existence check blocks a second emission for that `(event_type, work_date)` pair forever, regardless of what the row looks like on later inspection. Deliberately the simplest possible policy: no "was it later resolved" backfill logic, no un-sending.

## One function, not nine

`public.check_attendance_daily_flags()` — a single loop over yesterday's `unified_daily_attendance`, joined once to `employees`/`employees` (manager) for profile ids, with one independently `exception when others`-wrapped block per flag (mirrors `notify_attendance_clocked_out.sql`'s explicit-branches style — each block is individually exception-wrapped so one bad row/flag never blocks a sibling flag or the rest of the scan). All nine flags share the identical source query (one pass over one day's rows) — splitting into nine near-identical functions would mean nine near-identical queries re-scanning the same rows, nine files to keep in sync if the join or date-window logic ever changes, and nine cron call sites. This mirrors the same reasoning that already justifies bundling seven unrelated employee-lifecycle scans into one `check-employee-lifecycle-daily` job body in this codebase today.

## `notification_rules` seed rows

17 rows (8 flags × employee+manager, plus 1 employee-only FYI), each a plain `target_payload_keys` rule — no `target_roles`/`target_departments`, for the HR-cc reasoning above:

```sql
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('attendance.alert.late_arrival',            '{}'::jsonb, array['employee_profile_id'], array['in_app','email']),
  ('attendance.alert.late_arrival.manager',     '{}'::jsonb, array['manager_profile_id'],  array['in_app','email']),
  ('attendance.alert.early_leave',              '{}'::jsonb, array['employee_profile_id'], array['in_app','email']),
  ('attendance.alert.early_leave.manager',       '{}'::jsonb, array['manager_profile_id'],  array['in_app','email']),
  ('attendance.alert.missing_checkout',          '{}'::jsonb, array['employee_profile_id'], array['in_app','email']),
  ('attendance.alert.missing_checkout.manager',  '{}'::jsonb, array['manager_profile_id'],  array['in_app','email']),
  ('attendance.alert.incomplete_scans',          '{}'::jsonb, array['employee_profile_id'], array['in_app','email']),
  ('attendance.alert.incomplete_scans.manager',  '{}'::jsonb, array['manager_profile_id'],  array['in_app','email']),
  ('attendance.alert.absent',                    '{}'::jsonb, array['employee_profile_id'], array['in_app','email']),
  ('attendance.alert.absent.manager',            '{}'::jsonb, array['manager_profile_id'],  array['in_app','email']),
  ('attendance.alert.leave_conflict',            '{}'::jsonb, array['employee_profile_id'], array['in_app','email']),
  ('attendance.alert.leave_conflict.manager',    '{}'::jsonb, array['manager_profile_id'],  array['in_app','email']),
  ('attendance.alert.insufficient_half_day',         '{}'::jsonb, array['employee_profile_id'], array['in_app','email']),
  ('attendance.alert.insufficient_half_day.manager', '{}'::jsonb, array['manager_profile_id'],  array['in_app','email']),
  ('attendance.alert.leave_fraction_error',          '{}'::jsonb, array['employee_profile_id'], array['in_app','email']),
  ('attendance.alert.leave_fraction_error.manager',  '{}'::jsonb, array['manager_profile_id'],  array['in_app','email']),
  -- Employee-only FYI -- manager/HR side already served by attendance.approval_pending.
  -- in_app only, not email: not actionable by the employee, an email would be noise.
  ('attendance.alert.pending_approval_fyi', '{}'::jsonb, array['employee_profile_id'], array['in_app']);
```

## Cron registration

A new, dedicated job (`check-attendance-daily-flags-daily`), same `0 1 * * *` (09:00 MYT) slot as the two existing attendance jobs, but its own job name rather than folding into either — this function has by far the largest fan-out of anything in this notification system so far (up to 16 conditional `emit_notification_event` calls per employee per run, and a brand-new `link_to` query-string-building code path untested elsewhere — `attendance.approval_pending`'s link is a bare path with no query string). Keeping it isolated means `cron.job_run_details` points unambiguously at this function if something goes wrong during rollout, without conflating its early bugs with the two already-stable jobs. Fold it into an existing job later, once proven — the same way `check-employee-lifecycle-daily` grew to bundle seven scan functions over time.

## Concrete SQL shape (structure, not final production code)

```sql
create or replace function public._attendance_alert_already_sent(p_event_type text, p_entity_id text)
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.notification_events
        where event_type = p_event_type
          and entity_table = 'unified_daily_attendance'
          and entity_id = p_entity_id
    );
$$;

create or replace function public.check_attendance_daily_flags()
returns void language plpgsql security definer set search_path = '' as $$
declare
    v_row record;
    v_scan_date date := (now() at time zone 'Asia/Kuala_Lumpur')::date - 1;
    v_entity_id text;
begin
    for v_row in
        select
            uda.employee_uuid, uda.full_name, uda.work_date, uda.hr_flag,
            uda.is_late_arrival, uda.is_early_leave, uda.is_leave_attendance_conflict,
            uda.is_insufficient_half_day_hours, uda.has_leave_fraction_error,
            uda.is_weekend, uda.is_public_holiday,
            e.profile_id as employee_profile_id,
            m.profile_id as manager_profile_id
        from public.unified_daily_attendance uda
        join public.employees e on e.id = uda.employee_uuid
        left join public.employees m on m.id = e.manager_id
        where uda.work_date = v_scan_date
    loop
        v_entity_id := v_row.employee_uuid::text || '_' || v_row.work_date::text;

        if v_row.is_late_arrival then
            begin
                if v_row.employee_profile_id is not null
                   and not public._attendance_alert_already_sent('attendance.alert.late_arrival', v_entity_id) then
                    perform public.emit_notification_event(
                        'attendance.alert.late_arrival', 'unified_daily_attendance', v_entity_id,
                        jsonb_build_object(
                            'employee_id', v_row.employee_uuid,
                            'employee_profile_id', v_row.employee_profile_id,
                            'work_date', v_row.work_date,
                            'title', 'Late Arrival Flagged',
                            'message', format('You arrived after 9:00 AM on %s.', to_char(v_row.work_date, 'DD Mon YYYY')),
                            'link_to', format('/app/employee/attendance/list?lateArrival=true&startDate=%s&endDate=%s', v_row.work_date, v_row.work_date)
                        )
                    );
                end if;
            exception when others then
                raise warning 'attendance.alert.late_arrival failed for % / %: %', v_row.employee_uuid, v_row.work_date, sqlerrm;
            end;

            begin
                if v_row.manager_profile_id is not null
                   and not public._attendance_alert_already_sent('attendance.alert.late_arrival.manager', v_entity_id) then
                    perform public.emit_notification_event(
                        'attendance.alert.late_arrival.manager', 'unified_daily_attendance', v_entity_id,
                        jsonb_build_object(
                            'employee_id', v_row.employee_uuid,
                            'manager_profile_id', v_row.manager_profile_id,
                            'work_date', v_row.work_date,
                            'title', 'Team Member Late Arrival',
                            'message', format('%s arrived after 9:00 AM on %s.', v_row.full_name, to_char(v_row.work_date, 'DD Mon YYYY')),
                            'link_to', format('/app/employee/team-attendance/list?employee=%s&lateArrival=true&startDate=%s&endDate=%s',
                                               v_row.employee_uuid, v_row.work_date, v_row.work_date)
                        )
                    );
                end if;
            exception when others then
                raise warning 'attendance.alert.late_arrival.manager failed for % / %: %', v_row.employee_uuid, v_row.work_date, sqlerrm;
            end;
        end if;

        -- Repeat the same employee/manager double-block shape for:
        -- early_leave, missing_checkout (hr_flag = 'Missing App Check-Out'),
        -- incomplete_scans (hr_flag = 'Incomplete Card Scans'),
        -- leave_conflict, insufficient_half_day, leave_fraction_error,
        -- and pending_approval_fyi (employee-only) -- swap the boolean/
        -- hr_flag condition, event_type strings, message text, and the two
        -- link_to query strings from the tables above.

        if v_row.hr_flag = 'Absent' and not v_row.is_weekend and not v_row.is_public_holiday then
            -- same employee/manager double-block shape as late_arrival above
            null;
        end if;

    end loop;
end;
$$;
```

The repeated per-flag block is intentionally explicit rather than a generic loop over a flag-definitions array — matches this codebase's existing style and keeps each flag individually greppable/debuggable, more valuable than shorter code for a solo maintainer.

## Files this will create, when built

- `supabase/functions/check_attendance_daily_flags.sql` — the scan function + `_attendance_alert_already_sent` helper
- `supabase/sql_editor/notification_events_add_event_entity_index.sql` — the supporting index
- `supabase/sql_editor/seed_attendance_daily_flags_notification_rules.sql` — the 17 rule rows
- `supabase/sql_editor/schedule_check_attendance_daily_flags_cron.sql` — the new dedicated cron job
- `docs/setup/ATTENDANCE-DAILY-ALERTS-DEPLOYMENT-GUIDE.md` — a deployment guide, mirroring `docs/setup/HR-ATTENDANCE-LIFECYCLE-NOTIFICATIONS-DEPLOYMENT-GUIDE.md`
- This doc, and `NOTIFICATIONS-ARCHITECTURE.md`/`docs/NOTIFICATION-RULES-TRACKER.csv`, updated once shipped

## Verification, once built

Manually run `select check_attendance_daily_flags();` in Studio for a known test date/employee with active flags, confirm rows appear in `notifications` with the expected `link_to`, and click through a generated link end-to-end to confirm it lands on the correctly filtered My/Team Attendance page.
