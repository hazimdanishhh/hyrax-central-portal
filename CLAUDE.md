# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

Hyrax Central Portal is being built out as the unified portal for all Hyrax Oil employees — the target is real-time dashboards for every department and for executives. It's a companion to a separate project, the **Hyrax Data Platform**, which extracts data from SAP (ERP) and IoT devices and lands it in this app's Supabase backend; that pipeline is what will eventually feed the real-time dashboards here. Some tables/entities in this app are expected to eventually be populated by that external pipeline rather than solely through this app's own CRUD forms — keep that in mind when touching schema-adjacent code.

Module status, so "custom-built" isn't mistaken for "temporary/incomplete":
- **Sales/CRM** (`features/sales` — leads, clients, contacts, quotations): fully custom by design, not a stand-in. SAP has no leads/quotation workflow, so this is the permanent system of record for that process.
- **IT** (`features/it/assets`): fully custom today, with a possible future integration with **ManageEngine Endpoint Central Cloud** for asset data — treat the asset schema/service layer as something that may need to accommodate an external sync source later.
- **HR** (`features/hr/employees`, attendance, leave, recruitment, performance): semi-custom for now. Legacy HR data is expected to be migrated in through the Data Platform project eventually, which may reshape parts of this module.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview a production build locally
- `npm run lint` — ESLint (flat config, `eslint.config.js`)

There is no test suite/framework configured in this repo (no test script, no Jest/Vitest config, no `*.test.*` files under `src/`). Don't assume one exists.

Required env vars (see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, plus `VITE_GOOGLE_PICKER_API_KEY` / `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_APP_ID` for Google Drive picker features, and `GEMINI_API_KEY` for the AI Summary feature.

## Architecture

**Stack**: React 19 + Vite, React Router v7 (JSX route trees, not config objects), TanStack React Query v5, Supabase (Postgres + Auth + Storage) as the sole backend, SCSS modules, `react-hook-form`, `recharts`, `jspdf`/`jspdf-autotable` for PDF export. `axios` and `js-cookie` are in `package.json` but unused in `src/` — don't reach for them; use `supabase-js` and Supabase's own session persistence instead.

**Composition root**: `src/main.jsx` renders `<AppProviders><AppRouter /></AppProviders>`. There is no `App.jsx`.

- `src/routes/AppProviders.jsx` nests providers in a load-bearing order — each depends on the one above it: `QueryClientProvider` → `AuthProvider` → `ProfileProvider` → `AccessControlProvider` → `EmployeeProvider` → `ThemeProvider` → `MessageProvider` → `AttendanceProvider`. (`ProfileContext`/`EmployeeContext` read `useAuth()`'s session; `AccessControlContext` reads `useProfile()`; `AttendanceProvider` reads `useEmployee()`.)
- `src/routes/AppRouter.jsx` is a plain `<Routes>` tree. Public routes (`PublicRoutes` — login, `/`) render standalone; everything else nests under `/app` inside `ProtectedRoute` + `AppLayout` (sidenav + navbar + `<Outlet/>`, from `src/layouts/AppLayout.jsx` — the only layout). Per-domain route trees are split into their own files and spliced in as JSX fragments: `GeneralRoutes`, `WorkspaceRoutes`, `SalesRoutes`, `HRRoutes`, `FinanceRoutes`, `EmployeeRoutes`, `ITRoutes`, `HelpRoutes`, `SuperadminRoutes`. Follow this same "one file per domain, spliced into `AppRouter`" pattern when adding a new top-level module.

**Auth & access control** (`src/context/`): `AuthContext` wraps `supabase.auth` directly (`getSession()` + `onAuthStateChange`); Supabase persists the session itself (localStorage), there's no manual cookie/token handling. `ProfileContext` fetches the `profiles` row (joined to role/department) and derives `role`/`isSuperAdmin`/`isManager`/`isStaff`. `EmployeeContext` fetches the linked `employees` row. `AccessControlContext` combines both into `canAccess({roles, departments})`; superadmin bypasses all checks. Route-level gating uses two wrapper components: `ProtectedRoute` (session required → else redirect to `/login`) and `AccessRoute` (role/department required → else render `UnauthorizedUser`), e.g. `<AccessRoute departments={["HR"]}>`.

**Data layer — no generic services folder.** `src/services/` only holds Supabase *Storage* helpers (attendance photo upload/delete) — it is not where entity CRUD lives. Instead, each business entity gets a self-contained module under `src/features/<domain>/<entity>/`:

```
src/features/hr/employees/
├── private/
│   ├── api/     # employeesService.js, employeeMutations.js, employeesMetadataService.js, employeesOverview.js
│   └── hooks/   # useEmployeesOverview.js, useEmployeesMetadata.js, useEmployeeMutations.js
└── public/      # non-HR-safe directory-style views of the same entity
    ├── api/
    └── hooks/
```

Same shape repeats for `sales/{leads,clients,contacts}`, `it/assets`, `superadmin/users`. `aiSummary` is the outlier — just `api/fetchAiSummary.js` + `hooks/useAiSummary.js`, no CRUD scaffold.

API files (`*Service.js` / `*Mutations.js`) are plain async functions that call `supabase.from(table)...`, destructure `{ data, error }`, `if (error) throw error`, and return a plain shape (`{ data, totalCount }` for lists, the row for mutations). No classes, no try/catch — errors propagate to React Query. Hook files wrap these in `useQuery`/`useMutation`; mutation hooks consistently do `onMutate` (loading toast via `MessageContext`) → `onSuccess` (success toast + `queryClient.invalidateQueries`) → `onError` (friendly Postgres error mapping). A few older hooks directly under `src/hooks/` (`useEmployeesPublic`, `useAttendanceTypes`, `useEmployeeAssets`) predate this pattern and fetch via `useState`/`useEffect` — treat the `features/**` + React Query pattern as current, not these.

**List/CRUD pages follow one recipe** (see `src/pages/user/hr/employeeManagement/` as the reference implementation): a page-level `usePaginatedQuery({ queryKey, queryFn, pageSize, defaultSortBy })` (`src/hooks/usePaginatedQuery.js` — generic URL-searchParams-driven pagination/search/sort/filter hook, mirrors state into the URL so it's shareable/bookmarkable) drives the query; a `tableConfig.jsx` in the same folder defines one `columns` array (`key`, `label`, `getValue`, `editable`, `editor`, `options`, `section`, `required`, `show`) that is fed to **both** `DataTable` (list view) and `DataSidebar`→`DataForm` (create/edit slide-in panel) — `section` groups fields in the form, `editor` selects the widget in both places via a shared lookup map (`src/components/dataTable/editors/Editors.jsx`: `text`, `number`, `date`, `dateTime`, `select`, `asyncSelect`, `textarea`, `link`, `image`, `drivePicker`), and `show: false` hides a column from the table without dropping it from the form's data model. Sibling `filterConfig.js`, `sortConfig.js`, `layoutConfig.js` (and sometimes `overviewConfig.js` for a KPI tab) configure `ActiveFiltersBar`/`SortBar`/view-toggle/`OverviewCards`. Delete/save actions go through an `ActionModal` confirmation before calling the mutation hook. When building a new CRUD feature page, copy this file set (`tableConfig.jsx`, `filterConfig.js`, `sortConfig.js`, `layoutConfig.js`) rather than inventing a new shape.

Generic CRUD scaffolding lives in `src/components/crud/` (`PageLayout`, `PageHeader`, `PageActions`, `SortBar`, `ActiveFiltersBar`, `PageResult`, `NoResult`, `OverviewCards`, `DataForm`) and `src/components/dataTable/` (`DataTable`, `DataTableCell`, `editors/`) — reuse these rather than building bespoke table/form UI per feature.

**Path alias**: `@` → `src/` (configured in `vite.config.js`), e.g. `import x from "@/components/..."`. SCSS files automatically get `@use "@/styles/variables" as *;` injected (also in `vite.config.js`) — don't manually `@import` variables in `.scss` files.

**Misc conventions**:
- Static config/constants (nav links, mock data, field-config objects) live in `src/data/`, not `src/features/`.
- Cross-cutting helpers live in `src/functions/` (e.g. `dataTransform.js`'s `groupCount` used by overview hooks, `mediaQuery.jsx`'s `useMediaQuery`, `motionUtils.js` for framer-motion variants).
- ESLint flat config only lints `**/*.{js,jsx}`, extends `js.configs.recommended` + `react-hooks` + `react-refresh` (Vite), and treats unused vars as errors except names matching `^[A-Z_]`.
