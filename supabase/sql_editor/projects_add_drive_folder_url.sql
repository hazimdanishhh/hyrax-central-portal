-- Run once in the Supabase SQL editor. A single quick-access link to the
-- project's shared Drive folder/Shared Drive -- distinct from the
-- documents/task_documents library (documents_schema_migration.sql),
-- which tracks individually-attached files, not a "home folder" shortcut.
-- Set via the drivePicker editor (GoogleDriveEditor.jsx), which already
-- supports picking folders and Shared Drives (setIncludeFolders(true),
-- setEnableDrives(true)/supportDrives), so no picker changes are needed.
alter table public.projects
    add column if not exists drive_folder_url text;
