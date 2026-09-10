-- Run this once in the Supabase SQL editor.
--
-- Public holidays / company off-days, sourced from HR2000 (the legacy
-- system that already feeds leave_ledger_entries) -- three CSVs under
-- supabase/csv/ (kl-ph.csv, meru-ph.csv, kl-meru-off-day.csv). Replaces the
-- dead `leave_holidays` table (zero rows ever written or read, zero RLS
-- policies, and the wrong shape for this need -- country_id/state text
-- instead of a real work_location tie-in) rather than reviving it.
--
-- Idempotent: safe to re-run (drop-if-exists + ON CONFLICT DO NOTHING on the
-- seed).

-- ============================================================
-- 0. Drop the dead table this replaces
-- ============================================================
drop table if exists public.leave_holidays;

-- ============================================================
-- 1. Table
-- ============================================================
-- work_location_id NULL = applies to ALL locations (national statutory
-- holidays + company-wide off-days) -- the key design choice: a future
-- third work location automatically inherits every national/company
-- holiday for free; only a genuinely state-specific holiday needs a new
-- row entered for the new location's state. A specific work_location_id
-- means the holiday applies ONLY at that site (a state holiday for the
-- state that site happens to be in).
create table if not exists public.public_holidays (
    id bigint generated always as identity primary key,
    work_location_id bigint references public.work_locations(id),
    holiday_date date not null,
    -- HR2000's own code (e.g. 'N01', 'S09', 'C01') -- kept for
    -- traceability back to the source export only; no application logic
    -- reads this column.
    code text not null,
    name text not null,
    -- 'national' (federal statutory), 'state' (varies by which state a
    -- site is in -- NOT the same thing as work_location_id being set: a
    -- state holiday can still be NULL-scoped if it happens to be observed
    -- identically at every site, e.g. Nuzul Al-Quran below), 'company'
    -- (HR-granted, not statutory -- e.g. Festive Company Leave).
    category text not null check (category in ('national', 'state', 'company')),
    created_at timestamptz not null default now(),
    updated_at timestamptz default now()
);

-- NULLS NOT DISTINCT (Postgres 15+) so two NULL-scoped ("all locations")
-- rows on the same date are correctly treated as a conflict too -- the
-- default NULLS DISTINCT behavior would otherwise let the seed below
-- silently duplicate every NULL-scoped row on every re-run, since a plain
-- unique index never considers two NULLs equal.
create unique index if not exists public_holidays_location_date_idx
    on public.public_holidays (work_location_id, holiday_date) nulls not distinct;

-- ============================================================
-- 2. RLS -- company-wide reference data, no per-employee ownership, so
-- this mirrors project_categories_crud.sql's simple "anyone reads" shape
-- for SELECT, and addresses_crud.sql's HR-department-or-superadmin shape
-- for writes (NOT the 4-tier self/manager pattern used for personal data
-- like leave_ledger_crud.sql/attendance_logs_crud.sql -- nothing here is
-- owned by an individual employee).
-- ============================================================
alter table public.public_holidays enable row level security;

drop policy if exists "Anyone can view public holidays" on public.public_holidays;
create policy "Anyone can view public holidays" on public.public_holidays
for select to authenticated using (true);

drop policy if exists "HR CRUD" on public.public_holidays;
create policy "HR CRUD" on public.public_holidays
to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'HR'
  )
) with check (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'HR'
  )
);

drop policy if exists "Superadmin CRUD" on public.public_holidays;
create policy "Superadmin CRUD" on public.public_holidays
to authenticated
using (public.is_superadmin()) with check (public.is_superadmin());

-- ============================================================
-- 3. One-time seed -- NOT a recurring sync (unlike leave_ledger_entries'
-- weekly HR2000 CSV import). A yearly holiday calendar changes rarely and
-- by small edits; after this seed, HR maintains the table entirely through
-- the new Attendance > Settings admin page.
--
-- Dedup rule applied by hand while transcribing the two location CSVs
-- (kl-ph.csv, meru-ph.csv): any (code, date, description) appearing
-- IDENTICALLY in both files collapses to ONE row with work_location_id
-- NULL. This is NOT the same as "every N-code is national, every S-code is
-- state-specific" -- S09 (Nuzul Al-Quran, 2026-03-07) is coded 'S' in both
-- source files but is observed identically at both sites, so it collapses
-- to NULL here too. Trusting the code prefix alone would have silently
-- mis-scoped it as one-location-only. Everything that appears in only one
-- file keeps that file's specific location. kl-meru-off-day.csv's rows
-- (C01/C02, Festive Company Leave) are company-wide by construction --
-- imported directly as NULL-scoped.
--
-- ON CONFLICT targets the (work_location_id, holiday_date) unique index
-- above, so re-running this seed after a partial run / manual edit doesn't
-- duplicate or clobber anything.
-- ============================================================

insert into public.public_holidays (work_location_id, holiday_date, code, name, category)
values
    -- National + shared-state holidays (identical in kl-ph.csv and
    -- meru-ph.csv) -- applies at every work location.
    (null, '2026-01-01', 'S01', 'New Year', 'state'),
    (null, '2026-02-01', 'S05', 'Thaipusam', 'state'),
    (null, '2026-02-02', 'S05-RPL', 'Replacement Thaipusam', 'state'),
    (null, '2026-02-17', 'N01', 'Chinese New Year Day 1', 'national'),
    (null, '2026-02-18', 'N02', 'Chinese New Year Day 2', 'national'),
    (null, '2026-03-07', 'S09', 'Nuzul Al-Quran', 'state'),
    (null, '2026-03-20', 'N03-ADD', 'Additional Raya Puasa/Aidilfitri Leave', 'national'),
    (null, '2026-03-21', 'N03', 'Hari Raya Puasa/Aidilfitri Day 1', 'national'),
    (null, '2026-03-22', 'N04', 'Hari Raya Puasa/Aidilfitri Day 2', 'national'),
    (null, '2026-03-23', 'N04-RPL', 'Replacement Hari Raya Puasa/Aidilfitri Day 2', 'national'),
    (null, '2026-05-01', 'N05', 'Labour Day', 'national'),
    (null, '2026-05-27', 'N06', 'Hari Raya Haji Day 1', 'national'),
    (null, '2026-05-31', 'N07', 'Wesak Day', 'national'),
    (null, '2026-06-01', 'N08', 'Agong Birthday', 'national'),
    (null, '2026-06-02', 'N07-RPL', 'Replacement Wesak Day', 'national'),
    (null, '2026-06-17', 'N09', 'Awal Muharam (Maal Hijrah)', 'national'),
    (null, '2026-08-25', 'N10', 'Prophet Muhammad Birthday', 'national'),
    (null, '2026-08-31', 'N11', 'National Day', 'national'),
    (null, '2026-09-16', 'N12', 'Malaysia Day', 'national'),
    (null, '2026-11-08', 'N13', 'Deepavali', 'national'),
    (null, '2026-11-09', 'N13-RPL', 'Replacement Deepavali', 'national'),
    (null, '2026-12-25', 'N14', 'Christmas', 'national'),

    -- Company-granted off-days (kl-meru-off-day.csv) -- applies at every
    -- work location.
    (null, '2026-03-24', 'C01', 'Festive Company Leave 1', 'company'),
    (null, '2026-03-25', 'C02', 'Festive Company Leave 2', 'company'),

    -- KL-only (Federal Territory) state holidays.
    ((select id from public.work_locations where sub = 'KL'), '2026-02-01', 'S04', 'Federal Territory Day', 'state'),
    ((select id from public.work_locations where sub = 'KL'), '2026-02-03', 'S04-RPL', 'Replacement Federal Territory Day', 'state'),

    -- Meru-only (Selangor) state holidays.
    ((select id from public.work_locations where sub = 'MERU'), '2026-09-01', 'S36', 'Selangor SUKMA 2026 Victory', 'state'),
    ((select id from public.work_locations where sub = 'MERU'), '2026-12-11', 'S35', 'Sultan of Selangor Birthday', 'state')
on conflict (work_location_id, holiday_date) do nothing;
