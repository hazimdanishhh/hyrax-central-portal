# Notifications Architecture

**Status:** Phase 1 built (2026-08) — in-app notifications real, email plumbing built but unsent pending provider credentials. Phase 2 (2026-08) added the scheduled-scan event source and per-event recipient targeting (`target_payload_keys`) — see worked example 2.

This is the "somewhere to plan this out properly" doc for notifications, logging, and email across the whole system — started because the concrete ask was narrow (notify people when a sales lead's stage changes) but the actual need is general: **any table, any functionality** should be able to notify the right people, through the right channel, without inventing new plumbing each time.

## Why this shape, not something else

Before this pass, "notification" meant three disconnected, non-functional things: `MessageContext` (an ephemeral in-memory toast, only ever seen by the user who triggered their own action), a fully-built `Notifications.jsx`/Navbar bell UI backed entirely by a hardcoded mock array (`src/data/notificationData.js` — now deleted), and `log_sales_leads_stage_change.sql` (a trigger that only wrote to a read-only audit table, `sales_leads_stage_history`, with zero notification concept). Email didn't exist anywhere in either repo. The only precedent for "notify someone outside the app" was `hyrax-data-platform`'s Discord alerting — a good _philosophy_ to reuse (env-gated, fire-and-forget, never let a notification failure break the real operation) but the wrong channel/tech for this.

Industry practice for "any table, any functionality" is an **event-driven, generic event log + rule-based fan-out** — not hand-wiring bespoke notification code into each feature as it comes up. A domain event is written durably (a Postgres trigger, in the _same transaction_ as the business change — this is the transactional outbox pattern, for free, since triggers already run inside the triggering transaction); a rules table decides who cares about which event types and through which channel(s); a dispatcher fans that out into per-channel delivery records that are processed independently with their own retry/audit trail. This is the right-sized version of what dedicated "notification microservices" (SuprSend, MagicBell, etc.) do at enterprise scale, scoped down to Postgres tables + triggers + a couple of Supabase Edge Functions + `pg_cron` — Hyrax's actual volume never justifies a message broker.

## Data model

| Table                 | Purpose                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notification_events` | Generic, append-only. Any trigger on any table writes here via `emit_notification_event()`. This _is_ the extensibility point — a new use case is a new trigger call + a new rule row, never new dispatch code.                                                                                                  |
| `notification_rules`  | Who cares about which `event_type`, and how. `condition` (jsonb) matches against the event payload; recipients via `target_roles`/`target_departments` (same model as `canAccess({roles,departments})`), an explicit `target_employee_ids` list (stores `profiles.id`), and/or `target_payload_keys` — payload keys whose value is a recipient's `profiles.id`, for notifying whoever a specific event is _about_ (e.g. an employee's own manager) rather than a static role/department; `channels` picks `in_app`/`email`. |
| `notifications`       | Real backing for the bell/Notifications page. Shaped to match `NotificationCard`'s existing props almost exactly. RLS: a user reads/marks-read only their own rows; no client INSERT policy at all — only `fan_out_notification_event()` (`SECURITY DEFINER`) writes here.                                       |
| `email_queue`         | Pending sends, processed independently by `send-queued-emails` so a slow/failed email never blocks or corrupts the in-app notification, which already succeeded.                                                                                                                                                 |
| `email_log`           | Terminal record of every send attempt, success or exhausted-retry failure — the durable audit trail Discord alerts never had.                                                                                                                                                                                    |

See `supabase/sql_editor/notifications_schema_migration.sql` for the full DDL and RLS policies (all reuse `public.is_superadmin()`, the same helper built for `supabase/policies/profiles_crud.sql`).

## The dispatch flow

```
trigger on any table (e.g. sales_leads AFTER UPDATE)
  → emit_notification_event(event_type, entity_table, entity_id, payload)
      → INSERT notification_events                       [durable, always succeeds if reached]
      → fan_out_notification_event(event_id)              [wrapped so its own failure can't undo the insert above]
          → for each active notification_rules row matching event_type:
              → does `condition` match the event payload?  (empty condition = always)
              → resolve recipients: role/department match UNION explicit profile ids
              → channel 'in_app'  → INSERT notifications
              → channel 'email'  → INSERT email_queue         [body_html includes a "View in Hyrax Central
                                                                 Portal" link to https://portal.hyraxoil.com + link_to,
                                                                 whenever the payload sets one]

send-queued-emails (Edge Function, pg_cron every few minutes)
  → SELECT pending FROM email_queue
  → sendEmail(to, subject, html)   -- Resend or Gmail API, by EMAIL_PROVIDER env var
  → UPDATE email_queue (sent | pending-for-retry | failed after 3 attempts)
  → INSERT email_log
```

**Reliability, by design, not by luck**: every layer that could fail is wrapped so it can never take down the layer above it. A malformed `notification_rules.condition` only skips that one rule (caught inside the per-rule loop in `fan_out_notification_event`) — it doesn't stop other rules from firing. A `fan_out_notification_event` failure doesn't roll back the `notification_events` row already written. A failure in _that whole chain_ doesn't roll back the actual business transaction (the lead's stage update) — the trigger wraps its call to `emit_notification_event` in its own exception handler. This mirrors `hyrax-data-platform`'s own explicit design principle ("fail loudly, recover automatically") and its Discord alerting's "never let alerting break the pipeline" convention — same philosophy, applied here.

## Worked example 1: sales lead stage changes (change-triggered)

`log_sales_leads_stage_change.sql`'s existing `sales_leads_stage_history` insert is untouched. On a real stage change (not a brand-new lead), it now also calls:

```sql
perform public.emit_notification_event(
    'lead.stage_changed', 'sales_leads', new.id::text,
    jsonb_build_object(
        'old_stage', old.stage, 'new_stage', new.stage,
        'lead_id', new.id, 'lead_title', new.title, 'lead_owner_id', new.lead_owner_id,
        'title', 'Lead Stage Changed',
        'message', format('Lead "%s" moved from %s to %s.', new.title, old.stage, new.stage),
        'link_to', '/app/sales/leads/list/' || new.id
    )
);
```

`title`/`message`/`link_to` in the payload are a **convention, not an enforced schema** — `fan_out_notification_event` uses them directly for notification/email content when present, falling back to the raw `event_type`/payload dump otherwise. This keeps the fan-out mechanism fully generic while still producing human-readable content, by putting that responsibility on whichever trigger actually knows the human context.

The seed rule (`supabase/sql_editor/seed_lead_stage_notification_rule.sql`) fires only on `new_stage IN ('NEGOTIATION', 'WON')`, targeting `role='manager', department='SAL'` as a **placeholder** — "sales admin" isn't a real role today (only `staff`/`manager`/`superadmin` exist), and wasn't decided at design time. This is a data row, not code — point it at the real people (via `target_employee_ids`, role/department, or both) whenever that's known, no trigger/function changes required.

**Extending this to any other change-triggered event**: copy the pattern — call `emit_notification_event()` from that table's own trigger (or add one if it doesn't have one yet), with whatever `event_type`/payload makes sense, then insert a `notification_rules` row. Nothing else needs to change.

## Worked example 2: employee confirmation due soon (scheduled scan)

Not every notification has a row-change to hook into. `employees.confirmation_date` is set once, months before the deadline it's tracking, and nothing writes to that row as the deadline gets closer — the only thing that changes is _today's date_. There's no `UPDATE` for a trigger to react to, so this needed a second event **source** shape: a periodic scan instead of a trigger. Everything downstream of "an event gets emitted" — `emit_notification_event`, `fan_out_notification_event`, `notifications`, `email_queue`, `send-queued-emails` — is identical to worked example 1; only how the event gets emitted differs.

`supabase/functions/check_employee_confirmations_due_soon.sql` is a `pg_cron`-scheduled function (`supabase/sql_editor/schedule_check_employee_confirmations_cron.sql`, once daily, calling straight into Postgres — no `pg_net`/Edge Function needed, since the job never leaves Postgres) that scans for employees whose confirmation is due within 30 days and haven't already been notified, then calls `emit_notification_event()` for each:

```sql
perform public.emit_notification_event(
    'employee.confirmation_due_soon', 'employees', v_row.id::text,
    jsonb_build_object(
        'employee_id', v_row.id, 'employee_name', v_row.full_name,
        'confirmation_due_date', v_row.confirmation_due_date,
        'manager_profile_id', v_row.manager_profile_id,
        'title', 'Confirmation Review Due Soon',
        'message', format('%s''s probation confirmation is due on %s.', v_row.full_name, v_row.confirmation_due_date),
        'link_to', '/app/employees/' || v_row.id
    )
);
```

"Due soon" reuses the exact same rule as `get_hr_employees_dashboard_rpc.sql`'s `confirmations_due_soon_count` KPI (Probation status, `confirmation_date is null`, `confirmation_due_date = join_date + 6 months` falling within the next 30 days) — deliberately, so this notification and that dashboard tile can never disagree about what "due soon" means. `employees.confirmation_reminder_sent_at` is the dedup guard that keeps the daily scan from re-notifying the same employee for all 30 days of the window.

**This is also where `notification_rules.target_payload_keys` comes from.** The recipients that make sense here are the specific employee's own manager — not just "any HR manager" — but `fan_out_notification_event()`'s targeting was, until this pass, strictly static (`target_roles`/`target_departments`/`target_employee_ids`, all decided when the rule row is written, never from the event itself). `target_payload_keys` is the generic fix: a rule can list payload keys whose value is a recipient's `profiles.id`, resolved fresh per event. Here, the scan resolves `manager_profile_id` (via `employees.manager_id` → that manager's own `profile_id`) and puts it in the payload; the seed rule (`supabase/sql_editor/seed_employee_confirmation_notification_rule.sql`) lists `target_payload_keys = ['manager_profile_id']` **and** `target_roles/target_departments` for HR broadly, so both the direct owner and an oversight team are covered. Any future event that needs to notify "whoever this event is about" (not just a role/department) can reuse the same mechanism — no more engine changes needed for that pattern.

**Extending this to any other scheduled/time-based condition**: copy the pattern — write a scan function that finds newly-matching rows via a `where` clause plus a dedup column, call `emit_notification_event()` per match inside its own exception-wrapped block, schedule it with `pg_cron`. Full deployment steps: [`docs/setup/EMPLOYEE-CONFIRMATION-REMINDER-DEPLOYMENT-GUIDE.md`](./setup/EMPLOYEE-CONFIRMATION-REMINDER-DEPLOYMENT-GUIDE.md).

**A second scheduled-scan variant: recurring reminders with a cooldown, not just one-shot.** `confirmation_due_soon`'s dedup column (`confirmation_reminder_sent_at`) is a one-time flag — correct for a condition that resolves on its own (confirmed, or the date passes). But some conditions are an ongoing, unresolved backlog that's worth re-nagging about until someone actually fixes it — an overdue confirmation, a pending attendance approval sitting for days. For these, the dedup column is a **timestamp cooldown** instead of a one-shot flag: `where ... and (last_notified_at is null or last_notified_at < now() - interval 'N days')`. Same scan-function shape, same `emit_notification_event()` call, just re-firing on a cadence instead of exactly once. Worked examples: `check_employee_confirmations_overdue.sql` (7-day cooldown), `check_attendance_approvals_pending.sql` (24-hour cooldown, plus a 24-hour grace period before the first nag so a routine approval isn't immediately flagged).

## Email: both providers, fully built, gated by which secret exists

`send-queued-emails.ts` (`supabase/edge_functions/`) has complete, working implementations of **both**, selected by the `EMAIL_PROVIDER` secret (`resend` | `gmail` | unset → logs instead of sending, same env-gated-no-op convention as `alert.py`/`sendDiscordNotification`). Deploy the same way the existing `auto-clock-out.ts`/`generate-ai-summary.ts` are deployed (hand-pasted into the Supabase dashboard's Edge Function editor — this repo has no CLI/`config.toml` yet). Scheduling is captured in `supabase/sql_editor/schedule_send_queued_emails_cron.sql` — `pg_cron` + `pg_net` calling the deployed function's URL every 5 minutes, with the service-role key stored in Supabase Vault rather than pasted in plain text (unlike `auto-clock-out.ts`'s own cron, which was only ever set up ad hoc in the dashboard and isn't captured anywhere).

### Option A — Resend

1. Sign up, verify your sending domain via one DNS record (TXT or CNAME, ~15 minutes to propagate).
2. Generate an API key.
3. Set Edge Function secrets: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=<key>`, `RESEND_FROM_EMAIL=notifications@hyraxoil.com` (or whichever verified address).

Free tier (3,000 emails/month) is far beyond Hyrax's real volume for the foreseeable future. No Google Workspace admin involvement needed.

### Option B — Gmail API via Google Workspace domain-wide delegation

Since you're the Workspace admin, this is fully self-serve:

1. In Google Cloud Console (reuse the existing project already used for BigQuery in `hyrax-data-platform`, or a new one): create a service account, enable the **Gmail API** for that project.
2. In the **Google Workspace Admin Console** → Security → API Controls → Domain-wide Delegation: add the service account's Client ID, authorize the OAuth scope `https://www.googleapis.com/auth/gmail.send`.
3. Download the service account's JSON key.
4. Set Edge Function secrets: `EMAIL_PROVIDER=gmail`, `GMAIL_SERVICE_ACCOUNT_JSON=<the full JSON key, as a string>`, `GMAIL_SENDER_EMAIL=notifications@hyraxoil.com` (the mailbox the service account will send _as_ — must be a real mailbox in your Workspace).

True $0 cost, mail comes from a real `@hyraxoil.com` address. The tradeoff is entirely in step 1–2's setup, not ongoing maintenance. Full click-by-click walkthrough (exact Console/Admin Console navigation, testing steps, troubleshooting table): [`docs/setup/GMAIL-API-DOMAIN-WIDE-DELEGATION-GUIDE.md`](./setup/GMAIL-API-DOMAIN-WIDE-DELEGATION-GUIDE.md).

## Setup guides

- [`docs/setup/NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./setup/NOTIFICATIONS-DEPLOYMENT-GUIDE.md) — the exact ordered list of SQL/migrations/functions to run and Dashboard actions to take to deploy the core system (worked example 1), checkbox-by-checkbox.
- [`docs/setup/GMAIL-API-DOMAIN-WIDE-DELEGATION-GUIDE.md`](./setup/GMAIL-API-DOMAIN-WIDE-DELEGATION-GUIDE.md) — detailed walkthrough for Option B above.
- [`docs/setup/EMPLOYEE-CONFIRMATION-REMINDER-DEPLOYMENT-GUIDE.md`](./setup/EMPLOYEE-CONFIRMATION-REMINDER-DEPLOYMENT-GUIDE.md) — deployment steps for worked example 2 (the scheduled-scan pattern + `target_payload_keys`), on top of the core system above.
- [`docs/setup/HR-ATTENDANCE-LIFECYCLE-NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./setup/HR-ATTENDANCE-LIFECYCLE-NOTIFICATIONS-DEPLOYMENT-GUIDE.md) — deployment steps for the four recurring-cooldown notifications (`employee.confirmation_overdue`, `employee.confirmation_status_mismatch`, `employee.contract_action_due`, `attendance.approval_pending`), including the required cron-job rename.
- [`docs/setup/PROFILE-ONBOARDING-NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./setup/PROFILE-ONBOARDING-NOTIFICATIONS-DEPLOYMENT-GUIDE.md) — deployment steps for the three profile-created notifications (see [`ONBOARDING-WORKFLOW-ARCHITECTURE.md`](./ONBOARDING-WORKFLOW-ARCHITECTURE.md) Section A) and the manual employee-linking RPC.

## Tracking what's built vs. what's still an idea

- [`docs/NOTIFICATION-RULES-TRACKER.csv`](./NOTIFICATION-RULES-TRACKER.csv) — every notification event across every module (Sales, Finance, Operations, HR, IT, System), whether it's `Implemented` or just `Proposed`, and which existing dashboard KPI (if any) its condition is copied verbatim from, per the `confirmations_due_soon_count` precedent.
- [`docs/ONBOARDING-WORKFLOW-ARCHITECTURE.md`](./ONBOARDING-WORKFLOW-ARCHITECTURE.md) — full design (not yet implemented) for two of the tracker's `Proposed` rows: notifying superadmin/HR/the new hire themself when a brand-new profile is created, and notifying IT when HR flags that an employee needs a device.

Both are real, tested-for-syntax code today — nothing else needs to change to switch between them, or to run neither (queue safely accumulates, dispatcher logs instead of sending, until a secret is set).

## Roadmap — what's next, deliberately not built this pass

- **Monthly Sales/Finance report emails.** Different delivery pattern than event-triggered — same `email_queue`/sender plumbing, but a new `pg_cron` job that assembles the digest content (likely from the existing `get_sales_reports_dashboard`/`get_finance_dashboard` RPCs) and queues one email per recipient, rather than a trigger reacting to a single row change.
- **Extending to other tables/conditions.** Finance (e.g. an invoice overdue, a large payment received), Operations — each change-triggered case is "add a trigger call + a rule row," per worked example 1; each scheduled/time-based case follows worked example 2's scan-function pattern instead. The full inventory of what's built vs. still just a good idea, across every module, is tracked in [`docs/NOTIFICATION-RULES-TRACKER.csv`](./NOTIFICATION-RULES-TRACKER.csv).
- **HR/Attendance lifecycle rules** (`employee.confirmation_overdue`, `employee.confirmation_status_mismatch`, `employee.contract_action_due`, `attendance.approval_pending`) are now built, using the recurring-cooldown scan variant described above — see the tracker CSV for their exact status/files.
- **A rules-admin UI.** Right now, editing `notification_rules` means SQL. A page under the System module (same pattern as the Pipeline Status page) would let a superadmin manage rules/recipients without touching SQL — worth building once there are enough real rules to justify a UI over direct table edits.
- **Per-user notification preferences.** Let a user mute a notification type or choose in-app-only vs. email — not needed yet with one seeded rule, but the schema doesn't preclude adding a `notification_preferences` table later.
- **A real "admin" role**, if "sales admin" (or similar per-department admin concepts) turns out to need one beyond `staff`/`manager`/`superadmin`. Deliberately not decided or built this pass — `notification_rules.target_employee_ids` covers the gap until/unless a role is actually warranted.
- **Digest/batching.** If a single event could ever plausibly fan out to a lot of email (unlikely at Hyrax's scale, but worth naming), rate-limiting or digesting is a pattern to reach for later — not built now because there's no evidence it's needed.

## Non-goals

- Not replacing `hyrax-data-platform`'s Discord alerting — that's a parallel channel for a different audience (ops/pipeline health), unaffected by any of this.
- Not building a message broker, a dedicated notification microservice, or adopting a SaaS notification platform — Hyrax's real volume doesn't justify it, and the org's general small-team/low-overhead posture argues against adding a new category of infrastructure to maintain.
