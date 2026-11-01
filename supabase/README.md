# Moved to hyrax-supabase

On 2026-11-01 the database moved to its own repo, **`hyrax-supabase`** (github.com/hazimdanishhh/hyrax-portal-supabase), shared with `hyrax-data-platform`. Every database change is now a migration there, not SQL pasted into the dashboard.

| Was here | Now |
| --- | --- |
| `supabase/sql_editor/`, `functions/`, `triggers/`, `policies/`, `storage/`, `diagnostics/` | `hyrax-supabase/archive/portal/supabase/…` (same folder names; history only — what's live is `hyrax-supabase/supabase/migrations/`) |
| `supabase/edge_functions/<name>.ts` | `hyrax-supabase/supabase/functions/<name>/index.ts` (the parked `generate-sales-meeting-brief` is in `archive/parked-functions/`) |
| `supabase/catalog/`, `diagnostics/export_full_catalog.sql`, `scripts/catalog/`, `docs/portal/DATA-INVENTORY.md` | `hyrax-supabase/catalog/`, `scripts/catalog/`, `docs/DATA-INVENTORY.md` |
| `supabase/csv/` | `hyrax-supabase/supabase/seed-data/` |
| `tests/sql/` | `hyrax-supabase/tests/sql/` |
| `supabase/access-control/` | stayed in this repo: `docs/access-control/` |
