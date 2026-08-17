-- Run once in the Supabase SQL editor, after get_or_create_document.sql
-- and enforce_task_document_same_project.sql (functions), before
-- trg_enforce_task_document_same_project.sql (trigger) and
-- documents_crud.sql/task_documents_crud.sql (policies).
--
-- Adds a project-scoped document library (`documents`) plus a many-to-many
-- link to tasks (`task_documents`) -- Google Drive file references only,
-- no binary storage. A document belongs to exactly one PROJECT and may be
-- linked to zero, one, or many of that project's tasks, so the same file
-- can be attached at the project level with no task at all, or shared
-- across several tasks without duplicating its Drive metadata row per task.
create table public.documents (
    id            uuid primary key default gen_random_uuid(),
    project_id    uuid not null references public.projects(id) on delete cascade,
    -- CASCADE: a document's entire reason to exist is this project's
    -- existence, same rationale as tasks.project_id. This also means
    -- deleting a document (or its whole project) silently takes every
    -- task_documents link with it -- desired, not a footgun.
    drive_file_id text not null,
    name          text not null,
    url           text not null,
    mime_type     text,
    icon_url      text,
    -- Immutable audit fact ("who added this file to the project"), never
    -- reassigned -- same RESTRICT-by-default rationale as
    -- tasks.created_by/projects.created_by. Also who the "uploader or
    -- elevated member" delete policy checks against -- the INSERT policy
    -- additionally requires attached_by = current_employee_id(), so a
    -- working member can't attach a document and attribute it to someone
    -- else.
    attached_by   uuid not null references public.employees(id),
    attached_at   timestamptz not null default now(),
    constraint documents_url_not_blank check (btrim(url) <> ''),
    -- Prevents the same Drive file existing twice in one project's
    -- library, and gives project_id a covering index for free as the
    -- leading column (same reasoning as project_members/task_assignees'
    -- composite PKs). get_or_create_document() targets this exact
    -- constraint as its ON CONFLICT target.
    constraint documents_unique_file_per_project unique (project_id, drive_file_id)
);

comment on table public.documents is
    'Project-scoped Google Drive file library (Drive file references only -- no binary storage). Belongs to exactly one project; may be linked to zero, one, or many of that project''s tasks via task_documents. Rows are immutable once created -- no UPDATE policy; "editing" is remove + re-attach.';

create index documents_attached_by_idx on public.documents (attached_by);

create table public.task_documents (
    task_id     uuid not null references public.tasks(id) on delete cascade,
    -- CASCADE: this link's entire reason to exist is the task's own
    -- existence, same rationale as task_assignees.task_id. Does NOT
    -- delete the underlying document -- only the link.
    document_id uuid not null references public.documents(id) on delete cascade,
    -- CASCADE: if the document itself is deleted from the project's
    -- library, every link to it is meaningless and should go too.
    linked_by   uuid references public.employees(id),
    linked_at   timestamptz not null default now(),
    primary key (task_id, document_id)
);

comment on table public.task_documents is
    'Many-to-many link between a project''s documents and its tasks. document_id here MUST belong to the SAME project as task_id''s own project_id -- enforced by trigger (enforce_task_document_same_project), not just RLS. Rows are immutable -- no UPDATE policy; "editing" a link is unlink + re-link.';

-- task_id is already covered as the PK's leading column (same reasoning
-- as task_assignees_employee_id_idx's own header comment). document_id is
-- the PK's SECOND column, not covered by that index -- needed both for
-- "which tasks is this document linked to" lookups and so documents'
-- ON DELETE CASCADE doesn't have to full-scan this table per deleted
-- document.
create index task_documents_document_id_idx on public.task_documents (document_id);

-- Enable only here -- actual policies live in
-- supabase/policies/{documents,task_documents}_crud.sql.
alter table public.documents enable row level security;
alter table public.task_documents enable row level security;
