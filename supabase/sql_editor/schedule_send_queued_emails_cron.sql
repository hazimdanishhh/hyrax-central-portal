-- Run this once in the Supabase SQL editor, AFTER send-queued-emails has
-- been deployed as an Edge Function (see docs/NOTIFICATIONS-ARCHITECTURE.md).
--
-- Schedules the email dispatcher via pg_cron + pg_net (Postgres calling out
-- to an HTTP endpoint), same mechanism used for auto-clock-out.ts's cron --
-- that one's schedule was only ever set up in the dashboard UI and never
-- captured in this repo; this one is captured, so it survives a project
-- migration/restore.
--
-- The service-role key is stored in Supabase Vault rather than pasted
-- directly into the cron job body -- a plain-text key in cron.job would be
-- readable by anyone who can query that table. Run this block first,
-- replacing the placeholder with your actual service_role key (Project
-- Settings -> API):
select vault.create_secret(
    '<paste your service_role key here>',
    'send_queued_emails_service_role_key'
);

-- Required extensions (usually already enabled on a Supabase project, but
-- safe to re-run).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every 5 minutes. Adjust the schedule to taste -- there is no urgency
-- requirement for this queue today (nothing here is a live chat), and a
-- wider interval means fewer redundant no-op invocations when the queue is
-- empty.
select cron.schedule(
    'send-queued-emails-every-5-min',
    '*/5 * * * *',
    $$
    select net.http_post(
        url := 'https://nmymjcugfpkbycofutlk.supabase.co/functions/v1/send-queued-emails',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'send_queued_emails_service_role_key'
            )
        ),
        body := '{}'::jsonb
    );
    $$
);

-- To check it's actually running: select * from cron.job_run_details
-- order by start_time desc limit 20;
-- To unschedule (e.g. to change the interval -- schedule() with the same
-- job name does not update it, unschedule then re-run the block above):
-- select cron.unschedule('send-queued-emails-every-5-min');
