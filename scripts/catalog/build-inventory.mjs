// scripts/catalog/build-inventory.mjs
//
// Builds docs/portal/DATA-INVENTORY.md -- every live database object, what
// it reads, what reads it, where the app uses it, and where it is defined --
// from the live catalog export (supabase/catalog/*.csv, produced by
// supabase/diagnostics/export_full_catalog.sql) plus a scan of this repo and
// ../hyrax-data-platform. Generated, never hand-edited: re-export the
// catalog, then run `npm run catalog`. (2026-10-27, DASHBOARD-CONVENTIONS §10.)
import fs from "fs";
import path from "path";
import { readCsv } from "./csv.mjs";

const P = process.cwd();
const DP = path.resolve(P, "../hyrax-data-platform");
const OUT = path.join(P, "docs/portal/DATA-INVENTORY.md");
const C = (f) => readCsv(path.join(P, "supabase/catalog", `${f}.csv`));
const rel = C("relations"), fn = C("functions"), trg = C("triggers"), pol = C("policies"),
  dep = C("dependencies"), jobs = C("scheduled_jobs"), grants = C("grants");

// ── repo scan ───────────────────────────────────────────────────────────────
const strip = (s) => (s || "").replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const norm = (base, f) => path.relative(base, f).split(path.sep).join("/");
function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", ".venv", "venv", "__pycache__", "catalog"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}
const load = (base, dir, exts, prefix) =>
  walk(dir, exts).map((f) => ({ f: prefix + norm(base, f), t: fs.readFileSync(f, "utf8") }));
const src = load(P, path.join(P, "src"), [".js", ".jsx", ".ts"], "");
const edge = load(P, path.join(P, "supabase/edge_functions"), [".ts", ".js"], "");
const sql = [
  ...load(P, path.join(P, "supabase"), [".sql"], ""),
  ...load(DP, DP, [".sql"], "data-platform/"),
];
const py = load(DP, DP, [".py", ".yml", ".yaml", ".toml"], "data-platform/");

// ── objects ─────────────────────────────────────────────────────────────────
const objs = new Map();
for (const r of rel) objs.set(r.name, { name: r.name, schema: r.schema, kind: r.kind, r });
for (const f of fn) {
  const o = objs.get(f.name);
  if (!o) objs.set(f.name, { name: f.name, schema: f.schema, kind: "function", fns: [f] });
  else if (o.kind === "function") o.fns.push(f);
}
const names = [...objs.keys()];
const wordRe = (n) => new RegExp(`(?<![A-Za-z0-9_])${n}(?![A-Za-z0-9_])`);
for (const o of objs.values()) {
  const lit = new RegExp(`["'\`]${o.name}["'\`]`), w = wordRe(o.name);
  o.app = src.filter((s) => lit.test(s.t)).map((s) => s.f);
  o.edge = edge.filter((s) => w.test(s.t)).map((s) => s.f);
  o.dp = py.filter((s) => w.test(s.t)).map((s) => s.f);
  const defRe = new RegExp(`create\\s+(or\\s+replace\\s+)?(materialized\\s+view|view|function|table|procedure)\\s+(if\\s+not\\s+exists\\s+)?("?(public|private)"?\\.)?"?${o.name}"?[\\s(]`, "i");
  o.defs = sql.filter((s) => defRe.test(strip(s.t))).map((s) => s.f);
  o.usedBy = new Set();
  o.reads = new Set();
}
const link = (target, byKind, byName) => {
  const o = objs.get(target);
  if (!o || target === byName) return;
  o.usedBy.add(`${byKind}:${byName}`);
  objs.get(byName)?.reads.add(target);
};
for (const d of dep) link(d.depends_on.split(".").pop(), d.object_kind === "view" ? "view" : "matview", d.object);
for (const f of fn) {
  const body = strip(f.definition);
  for (const n of names) if (n !== f.name && wordRe(n).test(body)) link(n, "fn", f.name);
}
for (const t of trg) objs.get(t.function.split(".").pop())?.usedBy.add(`trigger:${t.on_table}`);
for (const j of jobs) for (const n of names) if (wordRe(n).test(j.command)) objs.get(n).usedBy.add(`cron:${j.jobname}`);
for (const p of pol)
  for (const n of names)
    if (wordRe(n).test(`${p.using_expression} ${p.with_check_expression}`)) objs.get(n).usedBy.add(`policy:${p.table_name}`);

// status: APP (the app or an Edge Function uses it) > DATA-PLATFORM > SYSTEM
// (cron / trigger / policy) > INDIRECT (only through other used objects) >
// UNUSED (nothing reaches it).
const isRoot = (o) => o.app.length || o.edge.length || o.dp.length ||
  [...o.usedBy].some((u) => /^(cron|trigger|policy):/.test(u));
const active = new Set([...objs.values()].filter(isRoot).map((o) => o.name));
for (let changed = true; changed;) {
  changed = false;
  for (const o of objs.values()) {
    if (active.has(o.name)) continue;
    if ([...o.usedBy].some((u) => /^(view|matview|fn):/.test(u) && active.has(u.split(":")[1]))) {
      active.add(o.name);
      changed = true;
    }
  }
}
for (const o of objs.values())
  o.status = o.app.length || o.edge.length ? "APP" : o.dp.length ? "DATA-PLATFORM"
    : [...o.usedBy].some((u) => /^(cron|trigger|policy):/.test(u)) ? "SYSTEM"
    : active.has(o.name) ? "INDIRECT" : "UNUSED";

const repoOnly = new Map();
const createRe = /create\s+(?:or\s+replace\s+)?(materialized\s+view|view|function|table)\s+(?:if\s+not\s+exists\s+)?(?:"?(?:public|private)"?\.)?"?([a-z_][a-z0-9_]*)"?/gi;
for (const s of sql) {
  const t = strip(s.t);
  for (let m; (m = createRe.exec(t));)
    if (!objs.has(m[2]) && !m[2].startsWith("_")) repoOnly.set(m[2], [...(repoOnly.get(m[2]) || []), s.f]);
}

// ── department grouping (by name) ───────────────────────────────────────────
const DEPTS = [
  ["Sales — forecast", /projection|chainladder|freqsev|model_ses|seasonal|orderbook|order_development|coverage_by_horizon|calibration|ensemble|model_baseline|monthly_trend/],
  ["Sales — leads & CRM", /sales_lead|lead_source|clients$|quotation|sales_target|sales_budget|rep_mapping|won_lead|sales_report_|can_view_sales/],
  ["Sales — orders", /sales_order|fulfil|deliver|order_book/],
  ["Sales — report layer", /^sales_|^get_sales_|^v_sales_monthly_series|^sap_sales_persons/],
  ["Finance", /invoice|receivable|collection|payment|bill|vendor|gl_|journal|account|finance|bank|business_partner|sap_customers|ar_dso/],
  ["HR — attendance, leave & payroll", /attendance|clock|payroll|leave|holiday|work_location|acknowledg|adjustment_reason|company_activity/],
  ["HR — people & lifecycle", /employee|lifecycle|profile|department|^roles$|nationalit|identification|termination|employment|offboarding|onboarding|hr_/],
  ["Workspace", /project|task|document/],
  ["IT", /it_asset/],
  ["Notifications & email", /notif|email/],
];
const deptOf = (n) => (DEPTS.find(([, re]) => re.test(n)) || ["Platform & shared"])[0];

// ── checks ──────────────────────────────────────────────────────────────────
const g = (name, role) => grants.find((x) => x.name === name && x.grantee === role)?.privileges || "";
const invokerOn = (r) => ["on", "true", "1", "yes"].includes((r.security_invoker || "").toLowerCase());
const polBy = {};
for (const p of pol) (polBy[p.table_name] ||= []).push(p);
const issues = [];
for (const r of rel) {
  if (r.kind === "view" && !invokerOn(r))
    issues.push(["Security", `\`${r.name}\``, `view runs with its owner's rights (bypasses RLS)${g(r.name, "anon") ? "; **anon can read it**" : ""}`]);
  if (r.kind === "table" && r.rls_enabled !== "true") issues.push(["Security", `\`${r.name}\``, "RLS off"]);
  if (r.kind === "table" && r.rls_enabled === "true" && !polBy[r.name])
    issues.push(["Access", `\`${r.name}\``, "RLS on but no policies — nobody can read it through the API"]);
}
// anon's default table grants are harmless while every table has RLS with
// authenticated-only policies (and the API never offers TRUNCATE): one
// summary line, not one per table. A view without security_invoker is the
// real exposure, reported above.
const anonRels = rel.filter((r) => g(r.name, "anon"));
const anonPolicies = pol.filter((p) => p.schema === "public" && /public|anon/.test(p.roles));
if (anonRels.length)
  issues.push(["Security", `${anonRels.length} tables / views`,
    `anon (logged-out) holds Supabase's default grants. RLS blocks it on tables (${anonPolicies.length} public-schema policies apply to anon), so only views without security_invoker are readable`]);
const anonFns = new Set(grants.filter((x) => x.kind === "function" && x.grantee === "anon").map((x) => x.name));
for (const f of fn.filter((f) => f.security_definer === "true" && anonFns.has(f.name) && !/trigger/i.test(f.returns)))
  issues.push(["Security", `\`${f.name}\``, "SECURITY DEFINER and callable by anon (logged-out)"]);
for (const o of objs.values()) {
  if (o.kind === "function" && o.fns.length > 1)
    issues.push(["Bug risk", `\`${o.name}\``, `${o.fns.length} live versions — calls can fail with PGRST203: ${o.fns.map((f) => `(${f.arguments})`).join(" / ")}`]);
  if (o.status === "UNUSED") issues.push(["Unused", `\`${o.name}\``, `${o.kind}; nothing in the app, data platform, cron, triggers or policies reaches it`]);
  if (!o.defs.length) issues.push(["Live only", `\`${o.name}\``, `${o.kind}; no definition in either repo`]);
}
for (const [n, files] of repoOnly) issues.push(["Repo only", `\`${n}\``, `defined in ${[...new Set(files)].join(", ")} but not live`]);
const needs = new Set(rel.map((r) => r.name));
for (const j of jobs) if (j.active !== "true") issues.push(["Cron", `\`${j.jobname}\``, "inactive"]);

// ── write ───────────────────────────────────────────────────────────────────
const short = (a, n = 3) => (a.length <= n ? a.join(", ") : `${a.slice(0, n).join(", ")} +${a.length - n}`);
const counts = {};
for (const o of objs.values()) counts[o.kind] = (counts[o.kind] || 0) + 1;
const lines = [];
lines.push("# Data inventory (generated)", "");
lines.push(`Generated by \`npm run catalog\` (\`scripts/catalog/build-inventory.mjs\`) from the live catalog export in \`supabase/catalog/\` (run \`supabase/diagnostics/export_full_catalog.sql\` to refresh it) and a scan of this repo and \`hyrax-data-platform\`. **Do not edit by hand.** What to do about it: \`DASHBOARD-CONVENTIONS.md\` §10.`, "");
lines.push(`**Live objects:** ${Object.entries(counts).map(([k, v]) => `${v} ${k}s`).join(" · ")} · ${trg.length} triggers · ${pol.length} policies · ${jobs.length} cron jobs.`, "");
lines.push("**Status:** APP — the app or an Edge Function uses it · DATA-PLATFORM — the SAP / IoT pipeline uses it · SYSTEM — only cron, a trigger or a policy · INDIRECT — only through other used objects · UNUSED — nothing reaches it.", "");
lines.push("## Findings", "", "| Type | Object | Finding |", "| --- | --- | --- |");
const order = ["Security", "Bug risk", "Access", "Live only", "Unused", "Repo only", "Cron"];
for (const i of issues.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))) lines.push(`| ${i[0]} | ${i[1]} | ${i[2].replace(/\|/g, "\\|")} |`);
lines.push("");
const byDept = {};
for (const o of objs.values()) (byDept[deptOf(o.name)] ||= []).push(o);
for (const d of [...DEPTS.map((x) => x[0]), "Platform & shared"].filter((d) => byDept[d])) {
  lines.push(`## ${d}`, "", "| Object | Kind | Status | App / Edge files | Reads | Read by | Defined in |", "| --- | --- | --- | --- | --- | --- | --- |");
  const kOrder = ["table", "view", "materialized view", "function"];
  for (const o of byDept[d].sort((a, b) => kOrder.indexOf(a.kind) - kOrder.indexOf(b.kind) || a.name.localeCompare(b.name))) {
    const extra = o.kind === "table" ? ` (~${Math.max(0, +o.r.estimated_rows)} rows)` : o.kind === "function" && o.fns.length > 1 ? ` (${o.fns.length} versions)` : "";
    lines.push(`| \`${o.name}\` | ${o.kind}${extra} | ${o.status} | ${short([...o.app, ...o.edge].map((f) => f.split("/").pop()))} | ${short([...o.reads], 4)} | ${short([...o.usedBy], 4)} | ${short(o.defs.map((f) => f.split("/").pop()), 2) || "**none**"} |`);
  }
  lines.push("");
}
fs.writeFileSync(OUT, lines.join("\n"));
console.log(`wrote ${path.relative(P, OUT)}: ${objs.size} objects, ${issues.length} findings`);
