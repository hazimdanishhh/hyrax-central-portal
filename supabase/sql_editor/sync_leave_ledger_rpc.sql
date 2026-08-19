-- Diff-sync entry point for the HR Leave Management "Import Leave CSV"
-- button (src/pages/user/hr/leaveManagement/LeaveManagement.jsx).
--
-- p_rows: jsonb array of {employee_code, leave_date, leave_type,
-- day_fraction, remarks} objects (raw strings, DD/MM/YYYY dates), in the
-- exact order they appeared in the uploaded CSV -- order matters, see
-- dedupe_ordinal below. The frontend sends every parsed row unfiltered; all
-- real validation happens here, server-side.
--
-- Two-phase validation, deliberately asymmetric:
--   - Structural errors (bad date format, day_fraction not 0.5/1.0, blank
--     employee_code, or a leave_type code this table has never seen before)
--     REJECT THE WHOLE UPLOAD -- raised as a Postgres exception, nothing
--     written. These signal "wrong file" or "HR2000 export changed shape",
--     not a normal data blip -- silently skipping an unrecognized leave-type
--     code would mean an entire future leave category vanishes from every
--     sync without anyone noticing, unacceptable once this feeds payroll.
--   - An employee_code that's well-formed but doesn't match any
--     employees.employee_id is SKIPPED (that one row only) -- the expected,
--     anticipated case (new hire not yet in `employees`, a typo, a resigned
--     employee HR2000 still carries), not a corruption signal.
--
-- Guardrail: mirrors hyrax-data-platform vigilance_iot's
-- VIGILANCE_MAX_WRITE_ROWS/VIGILANCE_ALLOW_BULK pattern, but inverted --
-- that guardrail caps how MUCH can be written in one cycle; this one floors
-- how LITTLE may remain, since a full-snapshot CSV should never shrink by
-- more than a little week over week, and a big drop is this system's
-- version of a bad/partial export wiping most of the table. A guardrail
-- trip returns a normal 200 JSON payload with a preview of what would be
-- removed -- this is a foreground, human-attended action, so the right UX
-- is "show HR what's about to happen and ask them to confirm", not a bare
-- thrown error.
--
-- Three response shapes:
--   p_dry_run = true                          -> status: 'preview'
--   p_dry_run = false, guardrail trips, no override -> status: 'blocked_guardrail'
--   p_dry_run = false, applied                -> status: 'applied'
--
-- Recommended frontend flow: call once with p_dry_run := true to render a
-- before/after preview screen; HR confirms; call again with
-- p_dry_run := false. If that second call comes back 'blocked_guardrail',
-- show wouldRemoveSample/wouldRemoveCount and require a second, explicit
-- confirmation before retrying with p_allow_shrink := true.
--
-- Run this once in the Supabase SQL editor, after leave_ledger_migration.sql
-- (hyrax-data-platform/infrastructure/) and leave_ledger_sync_log_migration.sql
-- (this folder) have both been run.
create or replace function public.sync_leave_ledger_from_snapshot(
    p_rows          jsonb,
    p_allow_shrink  boolean default false,
    p_dry_run       boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id                uuid;
    v_rejected_rows            jsonb;
    v_skipped_rows             jsonb;
    v_current_count            integer;
    v_incoming_count           integer;
    v_would_remove_count       integer;
    v_would_remove_sample      jsonb;
    v_would_add_count          integer;
    v_would_keep_count         integer;
    v_removed_count            integer;
    v_added_count              integer;
    v_kept_count               integer;
    v_result                   jsonb;
    v_guardrail_tripped        boolean;
begin
    -- 1. AuthZ: superadmin OR HR department.
    if not public.is_superadmin()
       and not exists (
           select 1 from public.profiles
           where profiles.id = auth.uid() and profiles.department_id = 7
       )
    then
        raise exception 'Not authorized to sync leave data';
    end if;

    v_actor_id := (select id from public.employees where profile_id = auth.uid());

    if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
        raise exception 'p_rows must be a non-empty jsonb array of leave rows';
    end if;

    -- 2. Parse + structural validation.
    create temporary table _parsed on commit drop as
    select
        ord::integer                                   as src_ordinal,
        nullif(trim(r->>'employee_code'), '')          as employee_code_raw,
        nullif(trim(r->>'leave_date'), '')             as leave_date_raw,
        nullif(trim(r->>'leave_type'), '')             as leave_type_raw,
        nullif(trim(r->>'day_fraction'), '')           as day_fraction_raw,
        nullif(r->>'remarks', '')                      as remarks
    from jsonb_array_elements(p_rows) with ordinality as t(r, ord);

    create temporary table _validated on commit drop as
    select
        p.*,
        case
            when p.employee_code_raw is null then 'missing_employee_code'
            when p.leave_date_raw is null or p.leave_date_raw !~ '^\d{2}/\d{2}/\d{4}$'
                then 'invalid_leave_date_format'
            when p.leave_type_raw is null then 'missing_leave_type'
            when p.day_fraction_raw is null or p.day_fraction_raw !~ '^\d+(\.\d+)?$'
                then 'invalid_day_fraction_format'
            when p.day_fraction_raw::numeric not in (0.5, 1.0)
                then 'day_fraction_not_half_or_full'
            when not exists (
                select 1 from public.leave_ledger_types lt where lt.code = p.leave_type_raw
            ) then 'unrecognized_leave_type_code'
            else null
        end as structural_error
    from _parsed p;

    select jsonb_agg(jsonb_build_object(
               'src_ordinal', src_ordinal, 'employee_code', employee_code_raw,
               'leave_date', leave_date_raw, 'leave_type', leave_type_raw,
               'day_fraction', day_fraction_raw, 'reason', structural_error
           ) order by src_ordinal)
    into v_rejected_rows
    from _validated
    where structural_error is not null;

    if v_rejected_rows is not null then
        raise exception 'Leave sync rejected: % row(s) failed structural validation -- fix the source export and re-upload; nothing was written',
            jsonb_array_length(v_rejected_rows)
            using detail = v_rejected_rows::text,
                  hint   = 'error.details is a JSON array of {src_ordinal, employee_code, leave_date, leave_type, day_fraction, reason}.';
    end if;

    -- 3. Resolve employee_code -> employees.id; unresolved rows are skipped,
    -- not rejected.
    create temporary table _resolved on commit drop as
    select
        v.src_ordinal,
        v.employee_code_raw                        as employee_code,
        to_date(v.leave_date_raw, 'DD/MM/YYYY')     as leave_date,
        lt.id                                       as leave_type_id,
        v.leave_type_raw                            as leave_type_code,
        v.day_fraction_raw::numeric                 as day_fraction,
        v.remarks,
        e.id                                        as employee_id
    from _validated v
    join public.leave_ledger_types lt on lt.code = v.leave_type_raw
    left join public.employees e on e.employee_id = v.employee_code_raw;

    select jsonb_agg(jsonb_build_object(
               'src_ordinal', src_ordinal, 'employee_code', employee_code,
               'leave_date', leave_date, 'leave_type', leave_type_code,
               'reason', 'unknown_employee_code'
           ) order by src_ordinal)
    into v_skipped_rows
    from _resolved
    where employee_id is null;

    -- 4. Build the new content-addressed set, with a per-group ordinal to
    -- disambiguate true duplicates (see leave_ledger_entries.dedupe_ordinal).
    create temporary table _incoming on commit drop as
    select
        employee_id, employee_code, leave_date, leave_type_id, leave_type_code,
        day_fraction, remarks, src_ordinal,
        public.leave_ledger_content_key(employee_id, leave_date, leave_type_id, day_fraction, remarks) as content_key,
        row_number() over (
            partition by employee_id, leave_date, leave_type_id, day_fraction, remarks
            order by src_ordinal
        ) as dedupe_ordinal
    from _resolved
    where employee_id is not null;

    select count(*) into v_current_count from public.leave_ledger_entries;
    select count(*) into v_incoming_count from _incoming;

    -- 5. Guardrail. Skipped entirely on the very first-ever import
    -- (v_current_count = 0), by construction -- there is nothing to shrink
    -- relative to.
    v_guardrail_tripped :=
        v_current_count > 0
        and v_incoming_count < (v_current_count * 0.70)
        and not p_allow_shrink;

    if v_guardrail_tripped and not p_dry_run then
        -- Count and sample are deliberately two separate queries -- the
        -- count must reflect the TRUE total (how much would actually be
        -- removed), not be capped by the 200-row display sample below.
        select count(*)
        into v_would_remove_count
        from public.leave_ledger_entries le
        where not exists (
            select 1 from _incoming inc
            where inc.content_key = le.content_key and inc.dedupe_ordinal = le.dedupe_ordinal
        );

        select jsonb_agg(x order by x.employee_code, x.leave_date)
        into v_would_remove_sample
        from (
            select le.employee_code, le.leave_date, le.leave_type_code, le.day_fraction, le.remarks
            from public.leave_ledger_entries le
            where not exists (
                select 1 from _incoming inc
                where inc.content_key = le.content_key and inc.dedupe_ordinal = le.dedupe_ordinal
            )
            limit 200
        ) x;

        return jsonb_build_object(
            'status', 'blocked_guardrail',
            'currentRowCount', v_current_count,
            'incomingRowCount', v_incoming_count,
            'thresholdPct', 70,
            'wouldRemoveCount', v_would_remove_count,
            'wouldRemoveSample', coalesce(v_would_remove_sample, '[]'::jsonb),
            'skipped', coalesce(v_skipped_rows, '[]'::jsonb),
            'message', format(
                'New snapshot has %s resolvable rows vs %s currently stored (%s%% of current) -- below the 70%% safety floor. Re-run with p_allow_shrink := true to proceed if this reduction is expected.',
                v_incoming_count, v_current_count,
                round(v_incoming_count::numeric / v_current_count * 100, 1)
            )
        );
    end if;

    -- 6. Dry run: preview the diff, write nothing.
    if p_dry_run then
        select count(*) into v_would_remove_count
        from public.leave_ledger_entries le
        where not exists (
            select 1 from _incoming inc
            where inc.content_key = le.content_key and inc.dedupe_ordinal = le.dedupe_ordinal
        );

        select
            count(*) filter (where le.id is null),
            count(*) filter (where le.id is not null)
        into v_would_add_count, v_would_keep_count
        from _incoming inc
        left join public.leave_ledger_entries le
            on le.content_key = inc.content_key and le.dedupe_ordinal = inc.dedupe_ordinal;

        return jsonb_build_object(
            'status', 'preview',
            'currentRowCount', v_current_count,
            'incomingRowCount', v_incoming_count,
            'wouldAddCount', v_would_add_count,
            'wouldKeepCount', v_would_keep_count,
            'wouldRemoveCount', v_would_remove_count,
            'wouldTripGuardrail',
                (v_current_count > 0 and v_incoming_count < (v_current_count * 0.70)),
            'skipped', coalesce(v_skipped_rows, '[]'::jsonb)
        );
    end if;

    -- 7. Apply -- one transaction (this whole function body already runs as
    -- a single implicit transaction under one RPC call; any unhandled
    -- exception from here on rolls back everything below, including the
    -- audit-log insert in step 8).
    create temporary table _removed on commit drop as
    with d as (
        delete from public.leave_ledger_entries le
        where not exists (
            select 1 from _incoming inc
            where inc.content_key = le.content_key and inc.dedupe_ordinal = le.dedupe_ordinal
        )
        returning employee_code, leave_date, leave_type_code, day_fraction, remarks
    )
    select * from d;

    select count(*) into v_removed_count from _removed;

    -- CREATE TABLE AS only accepts a SELECT/TABLE/VALUES query, not a bare
    -- INSERT even with RETURNING -- wrapped in a WITH clause, same pattern
    -- as _removed above, so the data-modifying statement is legal here.
    create temporary table _upserted on commit drop as
    with u as (
        insert into public.leave_ledger_entries (
            employee_id, employee_code, leave_date, leave_type_id, leave_type_code,
            day_fraction, remarks, source_row_ordinal, dedupe_ordinal,
            last_synced_by, last_seen_at, updated_at
        )
        select
            employee_id, employee_code, leave_date, leave_type_id, leave_type_code,
            day_fraction, remarks, src_ordinal, dedupe_ordinal,
            v_actor_id, now(), now()
        from _incoming
        on conflict (content_key, dedupe_ordinal) do update
            set last_seen_at       = now(),
                updated_at         = now(),
                last_synced_by     = excluded.last_synced_by,
                source_row_ordinal = excluded.source_row_ordinal
        returning (xmax = 0) as was_inserted
    )
    select * from u;

    select
        count(*) filter (where was_inserted),
        count(*) filter (where not was_inserted)
    into v_added_count, v_kept_count
    from _upserted;

    -- 8. Audit log, same transaction.
    insert into public.leave_ledger_sync_runs (
        uploaded_by, status, incoming_row_count, current_row_count,
        added_count, unchanged_count, removed_count, skipped_count,
        guardrail_overridden, summary
    ) values (
        v_actor_id, 'applied', v_incoming_count, v_current_count,
        v_added_count, v_kept_count, v_removed_count,
        coalesce(jsonb_array_length(v_skipped_rows), 0),
        p_allow_shrink,
        jsonb_build_object(
            'removedSample', (select jsonb_agg(x) from (select * from _removed limit 200) x),
            'skipped', coalesce(v_skipped_rows, '[]'::jsonb)
        )
    );

    v_result := jsonb_build_object(
        'status', 'applied',
        'currentRowCountBefore', v_current_count,
        'incomingRowCount', v_incoming_count,
        -- "updated" here means "reconfirmed present, identical content --
        -- only bookkeeping columns (last_seen_at/updated_at) touched". With
        -- a content-hash identity key, a row whose remarks/date/type/fraction
        -- actually changed is NOT representable as an in-place update -- it
        -- necessarily appears as one removed + one added row instead. This
        -- is a disclosed, deliberate limitation, not a bug -- the frontend
        -- must label this bucket "Unchanged", not "Updated".
        'added', v_added_count,
        'updated', v_kept_count,
        'removed', v_removed_count,
        'skipped', coalesce(v_skipped_rows, '[]'::jsonb),
        'removedSample', (select jsonb_agg(x) from (select * from _removed limit 200) x)
    );

    return v_result;
end;
$$;
