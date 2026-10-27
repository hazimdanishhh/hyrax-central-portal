-- ############################################################################
-- export_full_catalog.sql -- a full, read-only snapshot of every app object
-- in the live database (2026-10-27), for the data-layer audit
-- (DASHBOARD-CONVENTIONS §10). Nothing here changes anything.
--
-- HOW TO RUN: in the Supabase SQL editor, run ONE query at a time (the editor
-- shows only the last result), then "Export -> CSV" and save it under
-- supabase/catalog/ with the file name in its heading. If a result says it
-- was limited to N rows, tell Claude -- it will split that query.
--
-- Covers every schema the app owns (public, private, and any other non-
-- Supabase schema); leaves out Supabase's own (auth, storage, realtime, ...)
-- and objects that belong to an extension -- except storage buckets and
-- their file policies (queries 4, 12), which the app does own.
--
-- NOT in the database, so not here: deployed Edge Functions and their
-- secrets, auth settings / hooks, and project settings. Those come from the
-- Supabase CLI (`supabase functions list`) or the dashboard.
-- ############################################################################


-- ─── 1. relations.csv ──────────────────────────────────────────────────────
-- Every table, view, materialized view, partitioned and foreign table: RLS,
-- security_invoker, size, columns, and the full definition of each view.
select
    n.nspname as schema,
    c.relname as name,
    case c.relkind
        when 'r' then 'table' when 'p' then 'partitioned table'
        when 'v' then 'view' when 'm' then 'materialized view'
        when 'f' then 'foreign table' end as kind,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    coalesce(
        (select option_value from pg_options_to_table(c.reloptions)
         where option_name = 'security_invoker'), 'false') as security_invoker,
    pg_get_userbyid(c.relowner) as owner,
    c.reltuples::bigint as estimated_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) as size,
    obj_description(c.oid, 'pg_class') as comment,
    (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', ' order by a.attnum)
     from pg_attribute a
     where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns,
    case when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid, true) end as definition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'v', 'm', 'f')
  and n.nspname not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      '_realtime', 'extensions', 'graphql', 'graphql_public', 'vault', 'pgsodium',
      'pgsodium_masks', 'supabase_functions', 'supabase_migrations', 'net', 'cron',
      'pgbouncer', '_analytics', 'tiger', 'topology')
  and n.nspname not like 'pg\_%'
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by 1, 3, 2;


-- ─── 2. functions.csv ──────────────────────────────────────────────────────
-- Every function and procedure (RPCs, helpers, trigger functions), with its
-- full source.
select
    n.nspname as schema,
    p.proname as name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as returns,
    l.lanname as language,
    case p.prokind when 'f' then 'function' when 'p' then 'procedure' end as kind,
    p.prosecdef as security_definer,
    case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end as volatility,
    pg_get_userbyid(p.proowner) as owner,
    obj_description(p.oid, 'pg_proc') as comment,
    pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where p.prokind in ('f', 'p')
  and n.nspname not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      '_realtime', 'extensions', 'graphql', 'graphql_public', 'vault', 'pgsodium',
      'pgsodium_masks', 'supabase_functions', 'supabase_migrations', 'net', 'cron',
      'pgbouncer', '_analytics', 'tiger', 'topology')
  and n.nspname not like 'pg\_%'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1, 2, 3;


-- ─── 3. triggers.csv ───────────────────────────────────────────────────────
select
    n.nspname as schema,
    c.relname as on_table,
    t.tgname as name,
    case t.tgenabled when 'O' then 'enabled' when 'D' then 'disabled'
        when 'R' then 'replica only' when 'A' then 'always' end as status,
    np.nspname || '.' || p.proname as function,
    pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_namespace np on np.oid = p.pronamespace
where not t.tgisinternal
  and n.nspname not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      '_realtime', 'extensions', 'supabase_functions', 'supabase_migrations', 'net', 'cron')
order by 1, 2, 3;


-- ─── 4. policies.csv ───────────────────────────────────────────────────────
-- Every RLS policy (the same shape as docs/portal/TABLE-POLICIES.csv),
-- including storage.objects -- who may read / upload files in each bucket.
select schemaname as schema, tablename as table_name, policyname as name,
       cmd as command, permissive, roles, qual as using_expression,
       with_check as with_check_expression
from pg_policies
where schemaname not in ('auth', 'realtime', 'supabase_functions')
  and (schemaname <> 'storage' or tablename = 'objects')
order by 1, 2, 3;


-- ─── 5. dependencies.csv ───────────────────────────────────────────────────
-- What each view / materialized view reads: tables, other views and
-- functions. (Functions don't record what they read; the audit scans their
-- source from functions.csv instead.)
select distinct
    vn.nspname as schema,
    v.relname as object,
    case v.relkind when 'v' then 'view' when 'm' then 'materialized view' end as object_kind,
    coalesce(rn.nspname || '.' || r.relname, pn.nspname || '.' || pr.proname) as depends_on,
    case
        when r.relkind = 'r' then 'table' when r.relkind = 'p' then 'partitioned table'
        when r.relkind = 'v' then 'view' when r.relkind = 'm' then 'materialized view'
        when r.relkind = 'f' then 'foreign table' when pr.oid is not null then 'function'
    end as depends_on_kind
from pg_depend d
join pg_rewrite rw on rw.oid = d.objid
join pg_class v on v.oid = rw.ev_class
join pg_namespace vn on vn.oid = v.relnamespace
left join pg_class r on r.oid = d.refobjid and d.refclassid = 'pg_class'::regclass
left join pg_namespace rn on rn.oid = r.relnamespace
left join pg_proc pr on pr.oid = d.refobjid and d.refclassid = 'pg_proc'::regclass
left join pg_namespace pn on pn.oid = pr.pronamespace
where v.relkind in ('v', 'm')
  and (r.oid is null or r.oid <> v.oid)
  and (r.oid is not null or pr.oid is not null)
  and vn.nspname not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      '_realtime', 'extensions', 'graphql', 'graphql_public', 'vault', 'pgsodium',
      'pgsodium_masks', 'supabase_functions', 'supabase_migrations', 'net', 'cron')
  and vn.nspname not like 'pg\_%'
order by 1, 2, 4;


-- ─── 6. grants.csv ─────────────────────────────────────────────────────────
-- Who may read or write each table / view, and call each function, among
-- the roles the app's users arrive as.
select 'relation' as kind, table_schema as schema, table_name as name,
       grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where grantee in ('anon', 'authenticated', 'service_role')
  and table_schema not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      'extensions', 'graphql', 'graphql_public', 'vault', 'supabase_functions', 'net', 'cron')
group by 1, 2, 3, 4
union all
select 'function', routine_schema, routine_name, grantee, 'EXECUTE'
from information_schema.role_routine_grants
where grantee in ('anon', 'authenticated', 'service_role')
  and routine_schema not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      'extensions', 'graphql', 'graphql_public', 'vault', 'supabase_functions', 'net', 'cron')
group by 1, 2, 3, 4
order by 1, 2, 3, 4;


-- ─── 7. indexes.csv ────────────────────────────────────────────────────────
select schemaname as schema, tablename as table_name, indexname as name, indexdef as definition
from pg_indexes
where schemaname not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      'extensions', 'graphql', 'vault', 'supabase_functions', 'supabase_migrations', 'net', 'cron')
order by 1, 2, 3;


-- ─── 8. scheduled_jobs.csv ─────────────────────────────────────────────────
-- pg_cron jobs (e.g. materialized-view refreshes). If this errors with
-- "relation cron.job does not exist", pg_cron isn't enabled -- skip it.
select jobid, jobname, schedule, command, active from cron.job order by jobid;


-- ─── 9. extensions_and_realtime.csv ────────────────────────────────────────
select 'extension' as kind, extname as name, extversion as detail from pg_extension
union all
select 'realtime table', schemaname || '.' || tablename, pubname
from pg_publication_tables
order by 1, 2;


-- ─── 10. types.csv ─────────────────────────────────────────────────────────
-- Enums (e.g. lead stage, product type) with their values in order, and
-- domains.
select n.nspname as schema, t.typname as name, 'enum' as kind,
       string_agg(e.enumlabel, ', ' order by e.enumsortorder) as detail
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      'extensions', 'graphql', 'vault', 'pgsodium', 'supabase_functions', 'net', 'cron')
group by 1, 2
union all
select n.nspname, t.typname, 'domain', format_type(t.typbasetype, t.typtypmod)
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where t.typtype = 'd'
  and n.nspname not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      'extensions', 'graphql', 'vault', 'pgsodium', 'supabase_functions', 'net', 'cron')
order by 1, 3, 2;


-- ─── 11. constraints.csv ───────────────────────────────────────────────────
-- Primary keys, foreign keys (the relationships between tables), unique and
-- check constraints.
select n.nspname as schema, c.relname as table_name, con.conname as name,
       case con.contype when 'p' then 'primary key' when 'f' then 'foreign key'
           when 'u' then 'unique' when 'c' then 'check' when 'x' then 'exclusion' end as kind,
       case when con.contype = 'f' then fn.nspname || '.' || fc.relname end as references_table,
       con.convalidated as validated,
       pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
left join pg_class fc on fc.oid = con.confrelid
left join pg_namespace fn on fn.oid = fc.relnamespace
where con.contype in ('p', 'f', 'u', 'c', 'x')
  and n.nspname not in ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
      '_realtime', 'extensions', 'graphql', 'vault', 'pgsodium', 'supabase_functions',
      'supabase_migrations', 'net', 'cron')
  and n.nspname not like 'pg_%'
order by 1, 2, 4, 3;


-- ─── 12. storage_buckets.csv ───────────────────────────────────────────────
select id, name, public, file_size_limit, allowed_mime_types, created_at
from storage.buckets
order by name;


-- ─── 13. scheduled_job_runs.csv ────────────────────────────────────────────
-- The last 30 days of cron runs per job: how often each ran, failed, and
-- the latest error. Skip if pg_cron isn't enabled (query 8 errored).
select j.jobname, count(*) as runs,
       count(*) filter (where d.status = 'failed') as failed,
       max(d.start_time) as last_run,
       (array_agg(d.return_message order by d.start_time desc)
            filter (where d.status = 'failed'))[1] as last_error
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where d.start_time > now() - interval '30 days'
group by j.jobname
order by j.jobname;
