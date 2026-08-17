-- Run once, after projects_tasks_schema_migration.sql. Seeds the
-- categories the product owner named directly, so the picker isn't empty
-- on day one -- still freely extensible after via
-- get_or_create_project_category() (Sales' "create new prospect inline"
-- pattern, applied here).
insert into public.project_categories (name) values
    ('Internal Project'),
    ('External / Client Project'),
    ('Plant Upgrade'),
    ('Company Event');
