# Notifications Architecture

**Status:** Phase 1 built (2026-08) — in-app notifications real, email plumbing built but unsent pending provider credentials.

This is the "somewhere to plan this out properly" doc for notifications, logging, and email across the whole system — started because the concrete ask was narrow (notify people when a sales lead's stage changes) but the actual need is general: **any table, any functionality** should be able to notify the right people, through the right channel, without inventing new plumbing each time.

## Why this shape, not something else

Before this pass, "notification" meant three disconnected, non-functional things: `MessageContext` (an ephemeral in-memory toast, only ever seen by the user who triggered their own action), a fully-built `Notifications.jsx`/Navbar bell UI backed entirely by a hardcoded mock array (`src/data/notificationData.js` — now deleted), and `log_sales_leads_stage_change.sql` (a trigger that only wrote to a read-only audit table, `sales_leads_stage_history`, with zero notification concept). Email didn't exist anywhere in either repo. The only precedent for "notify someone outside the app" was `hyrax-data-platform`'s Discord alerting — a good _philosophy_ to reuse (env-gated, fire-and-forget, never let a notification failure break the real operation) but the wrong channel/tech for this.

Industry practice for "any table, any functionality" is an **event-driven, generic event log + rule-based fan-out** — not hand-wiring bespoke notification code into each feature as it comes up. A domain event is written durably (a Postgres trigger, in the _same transaction_ as the business change — this is the transactional outbox pattern, for free, since triggers already run inside the triggering transaction); a rules table decides who cares about which event types and through which channel(s); a dispatcher fans that out into per-channel delivery records that are processed independently with their own retry/audit trail. This is the right-sized version of what dedicated "notification microservices" (SuprSend, MagicBell, etc.) do at enterprise scale, scoped down to Postgres tables + triggers + a couple of Supabase Edge Functions + `pg_cron` — Hyrax's actual volume never justifies a message broker.

## Data model

| Table                 | Purpose                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notification_events` | Generic, append-only. Any trigger on any table writes here via `emit_notification_event()`. This _is_ the extensibility point — a new use case is a new trigger call + a new rule row, never new dispatch code.                                                                                                  |
| `notification_rules`  | Who cares about which `event_type`, and how. `condition` (jsonb) matches against the event payload; recipients via `target_roles`/`target_departments` (same model as `canAccess({roles,departments})`) and/or an explicit `target_employee_ids` list (stores `profiles.id`); `channels` picks `in_app`/`email`. |
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
              → channel 'email'  → INSERT email_queue

send-queued-emails (Edge Function, pg_cron every few minutes)
  → SELECT pending FROM email_queue
  → sendEmail(to, subject, html)   -- Resend or Gmail API, by EMAIL_PROVIDER env var
  → UPDATE email_queue (sent | pending-for-retry | failed after 3 attempts)
  → INSERT email_log
```

**Reliability, by design, not by luck**: every layer that could fail is wrapped so it can never take down the layer above it. A malformed `notification_rules.condition` only skips that one rule (caught inside the per-rule loop in `fan_out_notification_event`) — it doesn't stop other rules from firing. A `fan_out_notification_event` failure doesn't roll back the `notification_events` row already written. A failure in _that whole chain_ doesn't roll back the actual business transaction (the lead's stage update) — the trigger wraps its call to `emit_notification_event` in its own exception handler. This mirrors `hyrax-data-platform`'s own explicit design principle ("fail loudly, recover automatically") and its Discord alerting's "never let alerting break the pipeline" convention — same philosophy, applied here.

## Worked example: sales lead stage changes

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

**Extending this to any other table**: copy the pattern — call `emit_notification_event()` from that table's own trigger (or add one if it doesn't have one yet), with whatever `event_type`/payload makes sense, then insert a `notification_rules` row. Nothing else needs to change.

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

- [`docs/setup/NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./setup/NOTIFICATIONS-DEPLOYMENT-GUIDE.md) — the exact ordered list of SQL/migrations/functions to run and Dashboard actions to take to deploy everything described in this doc, checkbox-by-checkbox.
- [`docs/setup/GMAIL-API-DOMAIN-WIDE-DELEGATION-GUIDE.md`](./setup/GMAIL-API-DOMAIN-WIDE-DELEGATION-GUIDE.md) — detailed walkthrough for Option B above.

Both are real, tested-for-syntax code today — nothing else needs to change to switch between them, or to run neither (queue safely accumulates, dispatcher logs instead of sending, until a secret is set).

## Roadmap — what's next, deliberately not built this pass

- **Monthly Sales/Finance report emails.** Different delivery pattern than event-triggered — same `email_queue`/sender plumbing, but a new `pg_cron` job that assembles the digest content (likely from the existing `get_sales_reports_dashboard`/`get_finance_dashboard` RPCs) and queues one email per recipient, rather than a trigger reacting to a single row change.
- **Extending to other tables.** Finance (e.g. an invoice overdue, a large payment received), Operations, HR — each is "add a trigger call + a rule row," per the worked example above.
- **A rules-admin UI.** Right now, editing `notification_rules` means SQL. A page under the System module (same pattern as the Pipeline Status page) would let a superadmin manage rules/recipients without touching SQL — worth building once there are enough real rules to justify a UI over direct table edits.
- **Per-user notification preferences.** Let a user mute a notification type or choose in-app-only vs. email — not needed yet with one seeded rule, but the schema doesn't preclude adding a `notification_preferences` table later.
- **A real "admin" role**, if "sales admin" (or similar per-department admin concepts) turns out to need one beyond `staff`/`manager`/`superadmin`. Deliberately not decided or built this pass — `notification_rules.target_employee_ids` covers the gap until/unless a role is actually warranted.
- **Digest/batching.** If a single event could ever plausibly fan out to a lot of email (unlikely at Hyrax's scale, but worth naming), rate-limiting or digesting is a pattern to reach for later — not built now because there's no evidence it's needed.

## Non-goals

- Not replacing `hyrax-data-platform`'s Discord alerting — that's a parallel channel for a different audience (ops/pipeline health), unaffected by any of this.
- Not building a message broker, a dedicated notification microservice, or adopting a SaaS notification platform — Hyrax's real volume doesn't justify it, and the org's general small-team/low-overhead posture argues against adding a new category of infrastructure to maintain.
