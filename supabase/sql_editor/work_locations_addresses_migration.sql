-- work_locations_addresses_migration: adds the work_locations and addresses
-- tables, plus employees.work_location_id/personal_address_id -- see
-- docs/WORK-LOCATIONS-ARCHITECTURE.md for the full design rationale.
--
-- Additive only: address_work/address_personal stay on `employees`
-- untouched (not dropped) -- HR migrates each employee manually via the new
-- form fields at their own pace; nothing here auto-parses free text into
-- either new shape (a wrong guess would silently skew early-leave figures
-- with no obvious error, same caution this schema already applies to
-- leave_ledger_types' needs_hr_confirmation flags).

-- work_locations: small shared lookup, mirrors departments' exact shape
-- (the only existing lookup table with a short-code column). No is_active
-- column -- no lookup table in this schema has one, don't invent the
-- convention here.
create table public.work_locations (
    id bigint generated always as identity primary key,
    sub text not null default '' unique,
    name text not null,
    early_leave_time time not null default '17:00:00',
    created_at timestamptz not null default now(),
    updated_at timestamptz default now()
);

insert into public.work_locations (sub, name, early_leave_time) values
    ('KL', 'Kuala Lumpur (Office)', '17:00:00'),
    ('MERU', 'Meru (Blending Plant)', '17:30:00');

-- addresses: structured personal address, one row per employee -- unlike
-- work_locations (a shared lookup), this is normalization into components,
-- not a shared set of values. Not DB-enforced 1:1 with employees (matches
-- this schema's general preference for minimal constraints).
create table public.addresses (
    id bigint generated always as identity primary key,
    line1 text,
    line2 text,
    city text,
    state text,
    postcode text,
    country text,
    created_at timestamptz not null default now(),
    updated_at timestamptz default now()
);

alter table public.employees
    add column work_location_id bigint references public.work_locations(id),
    add column personal_address_id bigint references public.addresses(id);
