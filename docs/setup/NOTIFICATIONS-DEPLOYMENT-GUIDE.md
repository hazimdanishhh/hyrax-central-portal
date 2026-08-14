# Notifications System — Deployment Guide

Exact, ordered steps to deploy the notification system described in [`docs/NOTIFICATIONS-ARCHITECTURE.md`](../NOTIFICATIONS-ARCHITECTURE.md). Follow in order — later steps depend on earlier ones.

Everything under **SQL Editor** runs in the Supabase Studio SQL editor. Everything under **Dashboard** is a UI action elsewhere in Supabase Studio.

## 0. Prerequisite (should already be done)

- [ ] `supabase/functions/is_superadmin.sql` — required because the notifications schema's RLS policies call `public.is_superadmin()`. If this was already run during the Pipeline Status / RLS-recursion fix pass, skip it. If unsure, re-run it — it's idempotent (`create or replace function`).

## 1. Schema — tables + RLS

- [ ] Run **`supabase/sql_editor/notifications_schema_migration.sql`** as-is.

Creates `notification_events`, `notification_rules`, `notifications`, `email_queue`, `email_log`, plus all RLS policies. This will fail at the `create policy` statements if step 0 wasn't actually done first.

## 2. The two notification functions

Order doesn't matter between these two (Postgres doesn't validate a plpgsql function body against other objects until the function is actually _called_, not when it's created) — but both must exist before the trigger update in step 3 is exercised.

- [ ] Run **`supabase/functions/emit_notification_event.sql`**
- [ ] Run **`supabase/functions/fan_out_notification_event.sql`**

Both are complete `create or replace function ...` statements — run as-is.

## 3. Update the existing trigger function

The repo file `supabase/functions/log_sales_leads_stage_change.sql` is just the function **body** (this repo's convention for the Functions-editor UI, not a raw script). To run it directly in the SQL Editor, wrap it like this:

```sql
create or replace function public.log_sales_leads_stage_change()
returns trigger
language plpgsql
as $$
begin
    if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and old.stage is distinct from new.stage) then
        insert into public.sales_leads_stage_history (
            lead_id, previous_stage, new_stage, expected_revenue, close_probability
        ) values (
            new.id,
            case when TG_OP = 'UPDATE' then old.stage else null end,
            new.stage, new.expected_revenue, new.close_probability
        );

        if TG_OP = 'UPDATE' then
            begin
                perform public.emit_notification_event(
                    'lead.stage_changed', 'sales_leads', new.id::text,
                    jsonb_build_object(
                        'old_stage', old.stage, 'new_stage', new.stage,
                        'lead_id', new.id, 'lead_title', new.title,
                        'lead_owner_id', new.lead_owner_id,
                        'title', 'Lead Stage Changed',
                        'message', format('Lead "%s" moved from %s to %s.', new.title, old.stage, new.stage),
                        'link_to', '/app/sales/leads/list/' || new.id
                    )
                );
            exception when others then
                raise warning 'emit_notification_event failed for lead % stage change: %', new.id, sqlerrm;
            end;
        end if;
    end if;
    return new;
end;
$$;
```

- [ ] Run the block above.

(Alternatively: Supabase Studio → Database → Functions → edit `log_sales_leads_stage_change` → paste just the body from the repo file — either approach works; the block above is just the direct SQL-editor-runnable version of the same thing.)

## 4. Re-point the trigger

- [ ] Run **`supabase/triggers/trg_log_sales_lead_stage_change.sql`** as-is (`create or replace trigger`, safe even though the trigger already exists).

## 5. Seed the notification rule

- [ ] Open **`supabase/sql_editor/seed_lead_stage_notification_rule.sql`** first. It targets `role='manager', department='SAL'` as a placeholder ("sales admin" wasn't a resolved role at design time). Edit `target_roles`/`target_departments`/`target_employee_ids` now if you already know who should actually receive these, otherwise run as-is and `update` the row later — no code changes needed either way.
- [ ] Run the file.

**Checkpoint: in-app notifications now work end to end.** Change a lead from Proposal→Negotiation or →Won and the configured recipients get a real row in the bell/Notifications page. Steps 6–8 below are only needed for email.

## 6. Deploy the email dispatcher

- [ ] Dashboard → Edge Functions → new function named `send-queued-emails` → paste the contents of **`supabase/edge_functions/send-queued-emails.ts`** → deploy.

## 7. Set its secrets

Dashboard → Edge Functions → `send-queued-emails` → Secrets. Pick one provider (see [`GMAIL-API-DOMAIN-WIDE-DELEGATION-GUIDE.md`](./GMAIL-API-DOMAIN-WIDE-DELEGATION-GUIDE.md) if you're setting up Gmail):

- [ ] **Resend**: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=<your key>`, `RESEND_FROM_EMAIL=notifications@hyraxoil.com`
- [ ] **Gmail API**: `EMAIL_PROVIDER=gmail`, `GMAIL_SERVICE_ACCOUNT_JSON=<full JSON key as a string>`, `GMAIL_SENDER_EMAIL=notifications@hyraxoil.com`

(`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected into every Edge Function already — nothing to set there.)

## 8. Schedule it

- [ ] Open **`supabase/sql_editor/schedule_send_queued_emails_cron.sql`**, paste your real `service_role` key (Project Settings → API) into the `vault.create_secret(...)` call at the top, then run the whole file.

This enables `pg_cron`/`pg_net`, stores the key in Supabase Vault (not in plain text in the cron job itself), and schedules the dispatcher every 5 minutes.

## Verifying it all worked

- [ ] `select * from cron.job_run_details order by start_time desc limit 20;` — confirm the cron is actually firing.
- [ ] Change a lead's stage in the app to Negotiation or Won — confirm a row lands in `notifications` for the configured recipient(s), and (once secrets are set) a row lands in `email_log` with `status = 'sent'`.
- [ ] If an email fails, check `email_queue.last_error` (while `attempts < 3`, it'll retry automatically) or `email_log` (once attempts are exhausted).
