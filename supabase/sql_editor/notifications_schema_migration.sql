-- Run this once in the Supabase SQL editor.
--
-- Foundation for a generic, event-driven notification system -- any table's
-- trigger can emit an event here without new dispatch code; a rules table
-- decides who gets notified and through which channel(s). See
-- docs/NOTIFICATIONS-ARCHITECTURE.md for the full design.
--
-- notification_events: generic, append-only. Any trigger on any table
-- writes here via emit_notification_event() (see
-- supabase/functions/emit_notification_event.sql). This is the
-- transactional-outbox half of the pattern -- written in the SAME
-- transaction as the business change that caused it.
create table if not exists public.notification_events (
    id          bigserial primary key,
    event_type  text not null,
    entity_table text not null,
    entity_id   text not null,
    payload     jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now()
);

create index if not exists notification_events_event_type_idx
    on public.notification_events (event_type, occurred_at desc);

-- notification_rules: who cares about which event_type, and how.
-- `condition` matches against the event's payload -- e.g.
-- {"new_stage": ["NEGOTIATION", "WON"]} means "only fire when
-- payload->>'new_stage' is one of these values". An empty/null condition
-- always matches. Recipients can be role/department (same targeting model
-- as canAccess({roles,departments}) elsewhere in this app), an explicit
-- list of profile ids (named "employee_ids" for how admins will think
-- about it, but stores profiles.id -- the same uuid as auth.uid() and
-- employees.profile_id), or both combined.
create table if not exists public.notification_rules (
    id                  bigserial primary key,
    event_type          text not null,
    condition           jsonb not null default '{}'::jsonb,
    target_roles        text[] not null default '{}',
    target_departments   text[] not null default '{}',
    target_employee_ids uuid[] not null default '{}',
    channels            text[] not null default '{"in_app"}',
    is_active           boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists notification_rules_event_type_idx
    on public.notification_rules (event_type) where is_active;

-- notifications: the real backing for the already-built (currently mocked)
-- bell/Notifications page UI. Shaped to match NotificationCard's existing
-- props almost exactly -- see src/components/notifications/notificationCard/
-- NotificationCard.jsx and src/data/notificationData.js (the mock it
-- replaces).
create table if not exists public.notifications (
    id          bigserial primary key,
    user_id     uuid not null references public.profiles (id) on delete cascade,
    type        text not null default 'info', -- 'info' | 'warning' | 'error' | 'success'
    title       text not null,
    message     text not null,
    link_to     text,
    read_status boolean not null default false,
    created_by  text,
    created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
    on public.notifications (user_id, created_at desc);

-- email_queue: pending sends, processed independently by the
-- send-queued-emails Edge Function (pg_cron-scheduled). Kept separate from
-- notifications so an email retry/failure never blocks or corrupts the
-- in-app notification, which already succeeded the moment its row landed.
create table if not exists public.email_queue (
    id               bigserial primary key,
    to_email         text not null,
    subject          text not null,
    body_html        text not null,
    related_event_id bigint references public.notification_events (id) on delete set null,
    status           text not null default 'pending', -- 'pending' | 'sent' | 'failed'
    attempts         integer not null default 0,
    last_error       text,
    created_at       timestamptz not null default now(),
    sent_at          timestamptz
);

create index if not exists email_queue_status_idx
    on public.email_queue (status, created_at) where status = 'pending';

-- email_log: terminal record of every send attempt, success or
-- exhausted-retry failure -- the durable audit trail Discord alerts never
-- had (a Discord message scrolls away; this doesn't).
create table if not exists public.email_log (
    id         bigserial primary key,
    queue_id   bigint references public.email_queue (id) on delete set null,
    to_email   text not null,
    subject    text not null,
    status     text not null, -- 'sent' | 'failed'
    provider   text,          -- 'resend' | 'gmail'
    error      text,
    sent_at    timestamptz not null default now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- These are application-owned tables carrying per-user data (unlike the
-- sap_* pipeline tables, which deliberately leave RLS disabled) -- real
-- policies are needed here, not the pipeline-table convention.
--
-- notifications: a user reads/marks-read only their own rows. No client
-- INSERT policy at all -- rows are only ever created by
-- fan_out_notification_event() (SECURITY DEFINER, bypasses RLS for the
-- write), never directly by a user's own session.
alter table public.notifications enable row level security;

create policy "Users read own notifications"
on public.notifications
for select
to authenticated
using (user_id = auth.uid() or public.is_superadmin());

create policy "Users mark own notifications read"
on public.notifications
for update
to authenticated
using (user_id = auth.uid() or public.is_superadmin())
with check (user_id = auth.uid() or public.is_superadmin());

-- notification_events/notification_rules/email_queue/email_log: system
-- tables, not meant for direct end-user access at all. Superadmin-only
-- visibility (reusing the same public.is_superadmin() helper already
-- created for supabase/policies/profiles_crud.sql), for a future admin UI
-- to manage rules or inspect the email queue -- everything else writes
-- through SECURITY DEFINER functions or the Edge Function's service-role
-- key, both of which bypass RLS entirely regardless of these policies.
alter table public.notification_events enable row level security;
alter table public.notification_rules enable row level security;
alter table public.email_queue enable row level security;
alter table public.email_log enable row level security;

create policy "Superadmin CRUD" on public.notification_events
to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

create policy "Superadmin CRUD" on public.notification_rules
to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

create policy "Superadmin CRUD" on public.email_queue
to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

create policy "Superadmin CRUD" on public.email_log
to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
