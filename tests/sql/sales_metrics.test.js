// Runs the Sales Reports metric layer (supabase/sql_editor/
// sales_metric_facts_views.sql + sales_metric_functions.sql) against an
// in-process Postgres (PGlite) with stub source tables, and checks the three
// guarantees in docs/sales/SALES-REPORTS-TABS-PLAN.md §5:
//
//   1. DEFINITIONS   each fact view counts exactly what its comment says
//   2. CONSISTENCY   the same measure agrees across sales_totals,
//                    sales_monthly_series and sales_rep_totals
//   3. SCOPING       salesperson filter, unmapped owner, access guard
//
//   npm test
//
// The fixture month is May 2025 (complete, so no "in progress" cut applies);
// every expected number below is worked out by hand in the comments.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const SQL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../supabase/sql_editor",
);
const SQL_FILES = [
  "sales_metric_facts_views.sql",
  "sales_metric_functions.sql",
  "get_sales_summary_rpc.sql",
  "get_sales_pipeline_rpc.sql",
  "get_sales_orders_rpc.sql",
  "get_sales_invoicing_rpc.sql",
  "get_sales_collections_rpc.sql",
  "get_sales_team_rpc.sql",
];

// Employees / profiles
const E1 = "11111111-1111-1111-1111-111111111111"; // Ali, SAL manager, rep 1
const E2 = "22222222-2222-2222-2222-222222222222"; // Bob, SAL staff, rep 2
const E3 = "33333333-3333-3333-3333-333333333333"; // Cara, SAL, no SAP mapping
const E4 = "44444444-4444-4444-4444-444444444444"; // Dan, HR (no access)
const CLIENT = "99999999-9999-9999-9999-999999999999";

const MAY = ["2025-05-01", "2025-05-31"];
const FY25 = ["2025-04-01", "2026-03-31"];

let db;
const q = async (sql, params) => (await db.query(sql, params)).rows;
const n = (v) => (v == null ? v : Number(v));

async function as(profileId, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${profileId}', false)`);
  try {
    return await fn();
  } finally {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

async function totals(rep, owner, [from, to]) {
  const [row] = await q("select * from sales_totals($1, $2, $3, $4)", [rep, owner, from, to]);
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, n(v)]));
}

beforeAll(async () => {
  db = new PGlite();

  // Stub Supabase auth + roles, and only the source columns the layer reads.
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated nologin;
    create role anon nologin;

    create table departments (id int primary key, sub text);
    create table roles (id int primary key, name text);
    create table profiles (id uuid primary key, role_id int, department_id int, avatar_url text);
    create table employees (id uuid primary key, profile_id uuid);

    create table sap_customers (customer_code text primary key, customer_name text, local_export_flag text);
    create table sap_sales_persons (sales_rep_code bigint primary key, sales_rep_name text);
    create table employee_sales_rep_mapping (sales_rep_code bigint primary key, employee_id uuid unique);
    create table sap_invoices (
      doc_entry bigint primary key, invoice_date text, is_cancelled text,
      customer_code text, customer_name text, sales_rep_code bigint,
      total_amount numeric, total_amount_myr numeric, gross_profit numeric, paid_to_date numeric);
    create view sap_invoices_with_balance as
      select i.*, (i.total_amount_myr - i.paid_to_date) as outstanding_balance from sap_invoices i;
    create table sap_items (item_code text primary key, item_name text, item_group_code bigint, sales_uom text, inventory_uom text);
    create table sap_item_groups (group_code bigint primary key, group_name text);
    create table sap_invoice_lines (doc_entry bigint, line_num bigint, item_code text, quantity numeric, line_total numeric);
    create table sap_sales_orders (
      doc_entry bigint primary key, order_date text, is_cancelled text,
      customer_code text, sales_rep_code bigint, total_amount_myr numeric);
    create table sap_payments (doc_entry bigint primary key, payment_date text, is_cancelled text);
    create table sap_payment_applications (doc_entry bigint, payment_ref bigint, inv_type bigint, amount_applied_myr numeric);
    create table clients (id uuid primary key, name text);
    create table sales_leads (
      id uuid primary key, stage text, is_cancelled boolean, updated_at timestamptz,
      lead_owner_id uuid, client_id uuid, sap_customer_code text, product_type text,
      lead_source_type_id bigint, actual_revenue numeric,
      is_on_hold boolean default false, close_probability numeric, expected_revenue numeric,
      created_at timestamptz default '2025-01-01', lose_reason_id bigint);
    create table lead_source_types (id bigint primary key, name text);
    create table sales_leads_lose_reasons (id bigint primary key, name text);
    create table sap_sales_orders_with_fulfillment (
      doc_entry bigint primary key, order_date text, delivery_date text, is_cancelled text,
      status_code text, is_fully_delivered boolean, matched_invoice_count int,
      customer_code text, sales_rep_code bigint, total_amount_myr numeric);
    create table sales_leads_stage_history (lead_id uuid, new_stage text, changed_at timestamptz);
    create table sales_budgets (sales_rep_code bigint, budget_month date, budget_revenue numeric);
    create table sales_targets (lead_owner_id uuid, target_month date, target_revenue numeric);
  `);

  for (const f of SQL_FILES) {
    await db.exec(fs.readFileSync(path.join(SQL_DIR, f), "utf8"));
  }

  await db.exec(`
    insert into departments values (1, 'SAL'), (2, 'MGM'), (3, 'HRD');
    insert into roles values (1, 'staff'), (2, 'manager'), (3, 'superadmin');
    insert into profiles values
      ('${E1}', 2, 1, 'ali.png'), ('${E2}', 1, 1, null), ('${E3}', 2, 1, null), ('${E4}', 2, 3, null);
    insert into employees values ('${E1}', '${E1}'), ('${E2}', '${E2}'), ('${E3}', '${E3}'), ('${E4}', '${E4}');

    insert into sap_sales_persons values (1, 'Ali'), (2, 'Bob');
    insert into employee_sales_rep_mapping values (1, '${E1}'), (2, '${E2}');
    insert into sap_customers values ('C1', 'Acme Sdn Bhd', 'Local'), ('C2', 'Beta Ltd', 'Export'), ('C3', 'Cosmo', null);

    -- INVOICES. Invoiced in May (not cancelled, dated May): 1 + 2 + 4 + 7
    --   = 1000 + 500 + 300 + 100 = 1900, 4 invoices.
    --   per rep: rep 1 = 1100 (1, 7), rep 2 = 500, no rep = 300.
    insert into sap_invoices values
      (1, '2025-05-10', 'N', 'C1', 'Acme Sdn Bhd',    1,    1000, 1000,   200, 400),
      (2, '2025-05-12', 'N', 'C1', 'ACME SDN. BHD.',  2,     500,  500,    50, 500),  -- name variant
      (3, '2025-05-15', 'Y', 'C1', 'Acme Sdn Bhd',    1,    9999, 9999,     0,   0),  -- cancelled
      (4, '2025-05-20', 'N', 'C2', 'Beta Ltd',        null,  300,  300,    30,   0),  -- no rep
      (5, '2025-04-10', 'N', 'C2', 'Beta Ltd',        1,     700,  700,    70, 100),  -- April
      (6, '',           'N', 'C2', 'Beta Ltd',        1,      50,   50,     5,   0),  -- empty date
      (7, '2025-05-25', 'N', 'C3', 'Cosmo',           1,     100,  100, 10000,   0);  -- GP outlier

    insert into sap_item_groups values (10, 'Transformer Oil');
    insert into sap_items values ('I1', 'Oil A', 10, 'L', null), ('I2', 'Oil B', null, null, null);
    insert into sap_invoice_lines values (1, 0, 'I1', 2, 400), (1, 1, 'I2', 1, 300), (2, 0, 'I1', 1, 450), (3, 0, 'I1', 9, 9000);

    -- ORDERS. Booked in May: 2000 + 1000 + 800 = 3800, 3 orders, customers C1 + C2.
    --   per rep: rep 1 = 3000, rep 2 = 800.
    insert into sap_sales_orders values
      (11, '2025-05-03', 'N', 'C1', 1, 2000),
      (12, '2025-05-04', 'N', 'C2', 1, 1000),
      (13, '2025-05-05', 'Y', 'C1', 1, 5000),   -- cancelled
      (14, '2025-05-06', 'N', 'C1', 2,  800),
      (15, '',           'N', 'C1', 2,  777);   -- empty date

    -- COLLECTIONS. Collected in May = 400 + 500 (receipt 21, two invoices)
    --   + 100 (receipt 23 on April's invoice 5) = 1000; 2 receipts; customers C1, C2.
    --   per rep (invoice's rep): rep 1 = 400 + 100 = 500, rep 2 = 500.
    insert into sap_payments values
      (21, '2025-05-15', 'N'), (22, '2025-05-16', 'Y'), (23, '2025-05-18', 'N');
    insert into sap_payment_applications values
      (1,   21, 13, 400),
      (2,   21, 13, 500),
      (5,   23, 13, 100),
      (999, 23, 24, 250),   -- not an A/R invoice (on-account / other type)
      (1,   22, 13,  50),   -- cancelled receipt
      (3,   23, 13,  70);   -- cancelled invoice

    -- PLANS. Budget May: rep 1 = 3100 (31 days -> 100/day), rep 2 = 620.
    --   Target May: E1 = 4000, E2 = 1000.
    insert into sales_budgets values (1, '2025-05-01', 3100), (2, '2025-05-01', 620), (1, '2025-04-01', 3000);
    insert into sales_targets values ('${E1}', '2025-05-01', 4000), ('${E2}', '2025-05-01', 1000);

    -- WON DEALS. Won in May (Malaysia time, not cancelled): L2 2000 + L5 1000 = 3000.
    --   L1 closed 2025-05-31 20:00 UTC = 1 June 04:00 in Malaysia -> June.
    insert into clients values ('${CLIENT}', 'Acme (CRM)');
    insert into sales_leads values
      ('a0000000-0000-0000-0000-000000000001', 'WON',  false, '2025-06-02', '${E1}', '${CLIENT}', null, 'OIL', 1, 5000),
      ('a0000000-0000-0000-0000-000000000002', 'WON',  false, '2025-06-02', '${E1}', '${CLIENT}', null, 'OIL', 1, 2000),
      ('a0000000-0000-0000-0000-000000000003', 'WON',  true,  '2025-05-12', '${E1}', '${CLIENT}', null, 'OIL', 1, 9000),
      ('a0000000-0000-0000-0000-000000000004', 'LOST', false, '2025-05-12', '${E2}', '${CLIENT}', null, 'OIL', 1, null),
      ('a0000000-0000-0000-0000-000000000005', 'WON',  false, '2025-05-20 10:00+00', '${E2}', null, 'C2', 'OIL', 2, 1000);
    insert into sales_leads_stage_history values
      ('a0000000-0000-0000-0000-000000000001', 'WON', '2025-05-31 20:00+00'),
      ('a0000000-0000-0000-0000-000000000002', 'WON', '2025-05-10 03:00+00'),
      ('a0000000-0000-0000-0000-000000000003', 'WON', '2025-05-12 03:00+00');

    -- PIPELINE. Closed in May (Malaysia time): won L2 2000 + L5 1000; lost
    --   L3 (WON but cancelled -> lost, "Cancelled", expected 9000) + L4 (LOST,
    --   "Price", expected 3000) = 12000. Win rate 2 / 4 = 50%.
    --   Open today: L6 10000 @ 50% + L7 4000 @ 10% = 14000, weighted 5400.
    insert into lead_source_types values (1, 'Referral'), (2, 'Website');
    insert into sales_leads_lose_reasons values (1, 'Price');
    update sales_leads set expected_revenue = 9000 where id = 'a0000000-0000-0000-0000-000000000003';
    update sales_leads set expected_revenue = 3000, lose_reason_id = 1 where id = 'a0000000-0000-0000-0000-000000000004';
    insert into sales_leads (id, stage, is_cancelled, updated_at, lead_owner_id, client_id, product_type, lead_source_type_id, expected_revenue, close_probability) values
      ('a0000000-0000-0000-0000-000000000006', 'NEGOTIATION', false, '2025-05-01', '${E1}', '${CLIENT}', 'OIL', 1, 10000, 50),
      ('a0000000-0000-0000-0000-000000000007', 'DISCOVERY',   false, '2025-05-01', '${E2}', '${CLIENT}', 'OIL', 2,  4000, 10);

    -- ORDER BOOK (the Orders page's rules). No period: open = OB1 + OB2 + OB6
    --   = 3300 (3 orders); overdue = OB1 2000; delivered-not-invoiced = OB4 500.
    --   May: open orders placed in May = OB1 + OB2 = 3000; overdue 2000; unbilled 0.
    insert into sap_sales_orders_with_fulfillment values
      (31, '2025-05-03', '2025-05-20', 'N', 'O', false, 0, 'C1', 1, 2000),  -- open, overdue
      (32, '2025-05-04', '2099-01-01', 'N', 'O', false, 0, 'C2', 1, 1000),  -- open, not due
      (33, '2025-05-06', '2025-05-20', 'N', 'C', false, 0, 'C1', 2,  800),  -- closed in SAP
      (34, '2025-04-02', '2025-04-10', 'N', 'C', true,  0, 'C2', 2,  500),  -- delivered, not invoiced
      (35, '2025-05-07', '2025-05-20', 'Y', 'O', false, 0, 'C1', 1, 9999),  -- cancelled
      (36, '',           '',           'N', 'O', false, 0, 'C3', 1,  300);  -- open, no dates
  `);
});

describe("1. definitions (fact views)", () => {
  it("invoices: cancelled excluded, empty date kept as null, canonical customer name", async () => {
    const rows = await q("select doc_entry, invoice_date::text, customer_name from sales_invoice_facts order by doc_entry");
    expect(rows.map((r) => Number(r.doc_entry))).toEqual([1, 2, 4, 5, 6, 7]);
    expect(rows.find((r) => Number(r.doc_entry) === 6).invoice_date).toBeNull();
    // Invoice 2 says "ACME SDN. BHD." but customer C1 is one name everywhere.
    const names = await q("select count(distinct customer_name)::int as k from sales_invoice_facts where customer_code = 'C1'");
    expect(names[0].k).toBe(1);
  });

  it("invoices: gross-profit outlier (> 5x the invoice) is unknown, not summed", async () => {
    const [r] = await q("select gross_profit_myr from sales_invoice_facts where doc_entry = 7");
    expect(r.gross_profit_myr).toBeNull();
  });

  it("product lines: only lines of non-cancelled invoices, grouped item names", async () => {
    const rows = await q("select doc_entry, item_name, item_group_name, line_before_tax_myr from sales_invoice_line_facts order by doc_entry, line_num");
    expect(rows.map((r) => Number(r.doc_entry))).toEqual([1, 1, 2]);
    expect(rows[0].item_name).toBe("Oil A - (L)");
    expect(rows[1].item_group_name).toBe("Ungrouped");
  });

  it("collections: only applications to live A/R invoices from live receipts", async () => {
    const rows = await q("select invoice_doc_entry, applied_myr from sales_collection_facts order by payment_doc_entry, invoice_doc_entry");
    expect(rows.map((r) => [Number(r.invoice_doc_entry), n(r.applied_myr)])).toEqual([
      [1, 400],
      [2, 500],
      [5, 100],
    ]);
  });

  it("receivables: open balances only, canonical names", async () => {
    const rows = await q("select doc_entry, outstanding_myr from sales_receivable_facts order by doc_entry");
    // 1: 1000-400, 4: 300, 5: 700-100, 6: 50, 7: 100. Invoice 2 is fully paid; 3 cancelled.
    expect(rows.map((r) => [Number(r.doc_entry), n(r.outstanding_myr)])).toEqual([
      [1, 600],
      [4, 300],
      [5, 600],
      [6, 50],
      [7, 100],
    ]);
  });

  it("won deals: cancelled excluded, close date taken in Malaysia time", async () => {
    const rows = await q("select won_myr, closed_on::text from sales_won_lead_facts order by won_myr");
    expect(rows.map((r) => [n(r.won_myr), r.closed_on])).toEqual([
      [1000, "2025-05-20"], // no history row: falls back to updated_at
      [2000, "2025-05-10"],
      [5000, "2025-06-01"], // 2025-05-31 20:00 UTC is 1 June in Malaysia
    ]);
  });
});

describe("1b. definitions (pipeline and order book)", () => {
  it("leads: one outcome per lead; a cancelled WON lead is lost, never won", async () => {
    const rows = await q("select lead_id, outcome, closed_on::text, lost_reason from sales_lead_facts order by lead_id");
    expect(rows.map((r) => [r.lead_id.slice(-1), r.outcome, r.closed_on, r.lost_reason])).toEqual([
      ["1", "won", "2025-06-01", null],
      ["2", "won", "2025-05-10", null],
      ["3", "lost", "2025-05-12", "Cancelled"],
      ["4", "lost", "2025-05-12", "Price"],
      ["5", "won", "2025-05-20", null],
      ["6", "open", null, null],
      ["7", "open", null, null],
    ]);
    // sales_won_lead_facts is exactly the 'won' rows.
    const [{ k }] = await q("select count(*)::int as k from sales_won_lead_facts");
    expect(k).toBe(3);
  });

  it("order book: open / overdue / delivered-not-invoiced, cancelled excluded", async () => {
    const rows = await q("select doc_entry, is_open, is_overdue, delivered_not_invoiced from sales_order_book_facts order by doc_entry");
    expect(rows.map((r) => [Number(r.doc_entry), r.is_open, r.is_overdue, r.delivered_not_invoiced])).toEqual([
      [31, true, true, false],
      [32, true, false, false],
      [33, false, false, false],
      [34, false, false, true],
      [36, true, false, false], // no delivery date: not known to be overdue
    ]);
  });

  it("pipeline totals for May, and per owner", async () => {
    const [all] = await q("select * from sales_pipeline_totals(null, $1, $2)", MAY);
    expect([n(all.won), n(all.won_count), n(all.avg_deal), n(all.lost), n(all.lost_count), n(all.win_rate_pct)])
      .toEqual([3000, 2, 1500, 12000, 2, 50]);
    expect([n(all.open_value), n(all.weighted_value), n(all.open_count)]).toEqual([14000, 5400, 2]);
    const [ali] = await q("select * from sales_pipeline_totals($1, $2, $3)", [E1, ...MAY]);
    expect([n(ali.won), n(ali.lost), n(ali.win_rate_pct), n(ali.open_value)]).toEqual([2000, 9000, 50, 10000]);
    // Same "Won" as sales_totals, by construction.
    const t = await totals(null, null, MAY);
    expect(n(all.won)).toBe(t.won);
  });
});

describe("2. consistency (one definition, every view of it)", () => {
  it("sales_totals: May, everyone", async () => {
    expect(await totals(null, null, MAY)).toEqual({
      invoiced: 1900,
      invoice_count: 4,
      booked: 3800,
      order_count: 3,
      ordering_customers: 2,
      collected: 1000,
      payment_count: 2, // distinct receipts, not 3 application lines
      paying_customers: 2,
      won: 3000,
      won_count: 2,
      budget: 3720,
      target: 5000,
    });
  });

  it("plans prorate by day and read as null when not set", async () => {
    const half = await totals(1, null, ["2025-05-01", "2025-05-15"]);
    expect(half.budget).toBeCloseTo(1500, 6); // 3100 * 15/31
    const none = await totals(null, null, ["2024-01-01", "2024-01-31"]);
    expect(none.budget).toBeNull();
    expect(none.target).toBeNull();
    expect(none.invoiced).toBe(0); // actuals: a real zero
  });

  it("the selected months of the monthly series add up to the totals", async () => {
    const series = await q("select * from sales_monthly_series(null, null, $1, $2, $3, $4)", [...FY25, ...MAY]);
    expect(series).toHaveLength(12);
    const sel = series.filter((m) => m.in_period);
    expect(sel).toHaveLength(1);
    const t = await totals(null, null, MAY);
    for (const k of ["invoiced", "collected", "booked", "won", "budget", "target"]) {
      expect(n(sel[0][k])).toBeCloseTo(t[k], 6);
    }
  });

  it("the whole series adds up to the totals for the same window", async () => {
    const series = await q("select * from sales_monthly_series(null, null, $1, $2, $1, $2)", FY25);
    const t = await totals(null, null, FY25);
    const sum = (k) => series.reduce((s, m) => s + (n(m[k]) ?? 0), 0);
    expect(sum("invoiced")).toBeCloseTo(t.invoiced, 6); // 1900 + April's 700
    expect(sum("booked")).toBeCloseTo(t.booked, 6);
    expect(sum("collected")).toBeCloseTo(t.collected, 6);
    expect(sum("budget")).toBeCloseTo(t.budget, 6);
  });

  it("per-rep rows add up to the totals, unassigned documents included", async () => {
    const reps = await q("select * from sales_rep_totals(null, $1, $2) order by sales_rep_code nulls last", MAY);
    expect(reps.map((r) => [r.sales_rep_code == null ? null : Number(r.sales_rep_code), n(r.invoiced), n(r.booked), n(r.collected), n(r.budget)])).toEqual([
      [1, 1100, 3000, 500, 3100],
      [2, 500, 800, 500, 620],
      [null, 300, 0, 0, null], // invoice 4 has no rep: one "Unassigned" row
    ]);
    const t = await totals(null, null, MAY);
    const sum = (k) => reps.reduce((s, r) => s + (n(r[k]) ?? 0), 0);
    expect(sum("invoiced")).toBe(t.invoiced);
    expect(sum("booked")).toBe(t.booked);
    expect(sum("collected")).toBe(t.collected);
    expect(sum("budget")).toBe(t.budget);
  });
});

describe("3. scoping", () => {
  it("a salesperson narrows every measure, SAP side by rep and CRM side by owner", async () => {
    const t = await totals(1, E1, MAY);
    expect(t.invoiced).toBe(1100);
    expect(t.booked).toBe(3000);
    expect(t.collected).toBe(500);
    expect(t.budget).toBe(3100);
    expect(t.won).toBe(2000);
    expect(t.target).toBe(4000);
  });

  it("the unmapped sentinel (-1) matches nothing on the SAP side", async () => {
    const t = await totals(-1, E3, MAY);
    expect([t.invoiced, t.booked, t.collected]).toEqual([0, 0, 0]);
    expect(t.budget).toBeNull();
  });

  it("sales_report_scope: manager may pick anyone; staff are forced to themselves", async () => {
    const mgr = await as(E1, () => q("select * from sales_report_scope($1)", [E2]));
    expect([mgr[0].owner_id, Number(mgr[0].sales_rep_code), mgr[0].mapping_missing]).toEqual([E2, 2, false]);

    const staff = await as(E2, () => q("select * from sales_report_scope($1)", [E1]));
    expect(staff[0].owner_id).toBe(E2); // asked for Ali, got themselves
    expect(Number(staff[0].sales_rep_code)).toBe(2);

    const everyone = await as(E1, () => q("select * from sales_report_scope(null)"));
    expect([everyone[0].owner_id, everyone[0].sales_rep_code]).toEqual([null, null]);
  });

  it("sales_report_scope: an owner with no SAP mapping fails closed", async () => {
    const [r] = await as(E1, () => q("select * from sales_report_scope($1)", [E3]));
    expect(Number(r.sales_rep_code)).toBe(-1);
    expect(r.mapping_missing).toBe(true);
  });

  it("sales_report_scope: outside SAL/MGM, or signed out, is denied", async () => {
    await expect(as(E4, () => q("select * from sales_report_scope(null)"))).rejects.toThrow(/Access denied/);
    await expect(q("select * from sales_report_scope(null)")).rejects.toThrow(/Access denied/);
  });

  it("anon cannot read the fact views", async () => {
    await db.exec("set role anon");
    try {
      await expect(q("select * from sales_invoice_facts")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("report_period (the shared period rules)", () => {
  const period = async (s, e) => {
    const [r] = await q(
      "select start_date::text, end_date::text, prev_start::text, prev_end::text, trend_start::text, trend_end::text, has_period, comparison_is_partial from report_period($1, $2)",
      [s, e],
    );
    return r;
  };

  it.each([
    // [start, end, prev_start, prev_end, trend_start, trend_end]
    ["2025-10-01", "2025-10-31", "2025-09-01", "2025-09-30", "2025-04-01", "2026-03-31"], // month
    ["2025-03-01", "2025-03-31", "2025-02-01", "2025-02-28", "2024-04-01", "2025-03-31"], // Feb is shorter
    ["2028-03-01", "2028-03-31", "2028-02-01", "2028-02-29", "2027-04-01", "2028-03-31"], // leap year
    ["2025-10-01", "2025-12-31", "2025-07-01", "2025-09-30", "2025-04-01", "2026-03-31"], // quarter
    ["2025-04-01", "2026-03-31", "2024-04-01", "2025-03-31", "2025-04-01", "2026-03-31"], // fiscal year
    ["2025-01-01", "2025-12-31", "2024-01-01", "2024-12-31", "2025-01-01", "2025-12-31"], // calendar year
    ["2025-01-15", "2025-01-21", "2025-01-08", "2025-01-14", "2024-04-01", "2025-03-31"], // custom days
    ["2025-02-15", "2025-05-10", "2024-11-22", "2025-02-14", "2024-04-01", "2026-03-31"], // custom across FYs
  ])("%s → %s", async (s, e, ps, pe, ts, te) => {
    const r = await period(s, e);
    expect([r.prev_start, r.prev_end, r.trend_start, r.trend_end]).toEqual([ps, pe, ts, te]);
    expect(r.has_period).toBe(true);
    expect(r.comparison_is_partial).toBe(false);
  });

  it("no dates = the full current month, compared like-for-like to date", async () => {
    const r = await period(null, null);
    const [{ today, ms, me, pms, pme }] = await q(`
      select current_date::text as today,
             date_trunc('month', current_date)::date::text as ms,
             (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date::text as me,
             (date_trunc('month', current_date) - interval '1 month')::date::text as pms,
             least((date_trunc('month', current_date) - interval '1 day')::date,
                   (date_trunc('month', current_date) - interval '1 month')::date
                     + (current_date - date_trunc('month', current_date)::date))::text as pme`);
    expect(today >= ms && today <= me).toBe(true);
    expect([r.start_date, r.end_date, r.prev_start, r.prev_end]).toEqual([ms, me, pms, pme]);
    expect(r.has_period).toBe(false);
    expect(r.comparison_is_partial).toBe(true);
  });
});

describe("4. tab RPCs (one number, every tab)", () => {
  const rpc = async (name, who, start, end, owner = null) => {
    const [row] = await as(who, () =>
      q(`select ${name}($1, $2, $3) as r`, [start, end, owner]),
    );
    return row.r;
  };

  let summary, pipeline, orders, invoicing, collections, team;
  beforeAll(async () => {
    summary = await rpc("get_sales_summary", E1, ...MAY);
    pipeline = await rpc("get_sales_pipeline", E1, ...MAY);
    orders = await rpc("get_sales_orders", E1, ...MAY);
    invoicing = await rpc("get_sales_invoicing", E1, ...MAY);
    collections = await rpc("get_sales_collections", E1, ...MAY);
    team = await rpc("get_sales_team", E1, ...MAY);
  });

  it("the same figure is identical on every tab that shows it", () => {
    expect(n(summary.kpis.invoiced)).toBe(1900);
    expect(n(invoicing.kpis.invoiced)).toBe(1900);
    expect(n(orders.kpis.invoiced)).toBe(1900);
    expect(n(collections.kpis.invoiced)).toBe(1900);
    expect(n(summary.kpis.booked)).toBe(n(orders.kpis.booked));
    expect(n(summary.kpis.won)).toBe(n(pipeline.kpis.won));
    expect(n(summary.kpis.collected)).toBe(n(collections.kpis.collected));
    const teamSum = (k) => team.scorecard.reduce((s, r) => s + (n(r[k]) ?? 0), 0);
    expect(teamSum("invoiced")).toBe(1900);
    expect(teamSum("booked")).toBe(3800);
    expect(teamSum("collected")).toBe(1000);
    expect(teamSum("budget")).toBe(3720);
    const bridgeSum = summary.budgetBridge.reduce((s, r) => s + n(r.invoiced), 0);
    expect(bridgeSum).toBe(1900);
  });

  it("summary: period, comparison (April) and attainment", () => {
    expect(summary.meta.period).toEqual({ startDate: "2025-05-01", endDate: "2025-05-31", hasPeriod: true });
    expect(summary.meta.comparisonWindow).toEqual({ startDate: "2025-04-01", endDate: "2025-04-30", isPartial: false });
    expect(summary.meta.trendWindow).toEqual({ startDate: "2025-04-01", endDate: "2026-03-31" });
    expect(n(summary.kpis.prevInvoiced)).toBe(700);
    expect(n(summary.kpis.budgetAttainmentPct)).toBe(51); // 1900 / 3720
    expect(n(summary.kpis.targetAttainmentPct)).toBe(60); // 3000 / 5000
    expect(summary.revenueVsBudget).toHaveLength(12);
  });

  it("summary: Order-to-Cash YoY sums the same monthly series per fiscal year", () => {
    expect(summary.orderToCashYoY).toHaveLength(10);
    const fy25 = summary.orderToCashYoY.find((y) => y.name === "2025-2026");
    expect([n(fy25.invoiced), n(fy25.booked), n(fy25.collected), n(fy25.won)]).toEqual([2600, 3800, 1000, 8000]);
    expect(fy25.inPeriod).toBe(true);
  });

  it("invoicing: concentration shares and breakdowns", () => {
    const k = invoicing.kpis;
    expect(n(k.budgetAttainmentPct)).toBe(51);
    expect(invoicing.invoicedVsBudget).toHaveLength(12);
    expect(n(k.customerTop5Pct)).toBe(100);
    expect(k.topCustomerName).toBe("Acme Sdn Bhd"); // one row despite two spellings
    expect(n(k.topCustomerPct)).toBe(78.9); // 1500 / 1900
    expect(n(k.productTop5Pct)).toBe(100);
    expect(k.topProductName).toBe("Oil A - (L)");
    expect(n(k.topProductPct)).toBe(73.9); // 850 / 1150, both before tax
    expect([k.topGroupName, n(k.topGroupPct)]).toEqual(["Transformer Oil", 73.9]);
    expect(invoicing.topCustomers.map((c) => [c.customerCode, n(c.invoiced), n(c.collected)])).toEqual([
      ["C1", 1500, 900],
      ["C2", 300, 100],
      ["C3", 100, 0],
    ]);
    expect(invoicing.exportLocal.map((x) => [x.name, n(x.value)])).toEqual([
      ["Local", 1500],
      ["Export", 300],
      ["Unspecified", 100],
    ]);
  });

  it("pipeline: tiles and breakdowns for May", () => {
    const k = pipeline.kpis;
    expect([n(k.won), n(k.target), n(k.targetAttainmentPct), n(k.winRatePct), n(k.lost)]).toEqual([3000, 5000, 60, 50, 12000]);
    expect([n(k.openValue), n(k.weightedValue), n(k.openCount)]).toEqual([14000, 5400, 2]);
    expect(pipeline.wonVsTarget).toHaveLength(12);
    expect(pipeline.wonBySource.map((x) => [x.name, n(x.value)])).toEqual([["Referral", 2000], ["Website", 1000]]);
    expect(pipeline.topClients.map((x) => [x.name, n(x.value)])).toEqual([["Acme (CRM)", 2000], ["Beta Ltd", 1000]]);
    expect(pipeline.lostByReason.map((x) => [x.name, n(x.value), n(x.count)])).toEqual([["Cancelled", 9000, 1], ["Price", 3000, 1]]);
    expect(pipeline.openByStage.map((x) => [x.name, n(x.value), n(x.weighted)])).toEqual([["DISCOVERY", 4000, 400], ["NEGOTIATION", 10000, 5000]]);
  });

  it("orders: bookings, book-to-bill and the order book rule", async () => {
    const k = orders.kpis;
    expect([n(k.booked), n(k.orderCount), n(k.bookToBill), n(k.prevBookToBill)]).toEqual([3800, 3, 2, 0]);
    // A period picked: orders placed in May.
    expect([n(k.orderBookValue), n(k.orderBookOrders), n(k.overdueValue), n(k.unbilledValue)]).toEqual([3000, 2, 2000, 0]);
    expect(orders.topCustomers.map((c) => [c.customerCode, n(c.value)])).toEqual([["C1", 2800], ["C2", 1000]]);
    // No period: the whole current backlog.
    const all = await rpc("get_sales_orders", E1, null, null);
    expect([n(all.kpis.orderBookValue), n(all.kpis.orderBookOrders), n(all.kpis.overdueOrders), n(all.kpis.unbilledValue)]).toEqual([3300, 3, 1, 500]);
  });

  it("collections: rate, payers, and the backlog rule for receivables", async () => {
    expect(n(collections.kpis.collectionRatePct)).toBe(52.6); // 1000 / 1900
    expect(collections.topPayers.map((p) => [p.customerCode, n(p.value)])).toEqual([
      ["C1", 900],
      ["C2", 100],
    ]);
    // A period picked: invoices raised in May that are still open.
    expect(n(collections.kpis.outstanding)).toBe(1000); // 600 + 300 + 100
    // No period: the whole current backlog, whatever month it was raised in.
    const all = await rpc("get_sales_collections", E1, null, null);
    expect(n(all.kpis.outstanding)).toBe(1650);
    expect(all.meta.period.hasPeriod).toBe(false);
  });

  it("team: per-rep rows with null (not 0) where there's nothing to divide by", () => {
    const rows = Object.fromEntries(team.scorecard.map((r) => [r.name, r]));
    expect(n(rows.Ali.attainmentPct)).toBe(35); // 1100 / 3100
    expect(rows.Ali.avatarUrl).toBe("ali.png");
    expect(rows.Unassigned.attainmentPct).toBeNull(); // no budget
    expect(n(rows.Unassigned.invoiced)).toBe(300);
    expect(team.grossProfitByRep.map((r) => [r.name, n(r.invoiced), n(r.grossProfit)])).toEqual([
      ["Ali", 1100, 200], // invoice 7's outlier GP is unknown, not summed
      ["Bob", 500, 50],
      ["Unassigned", 300, 30],
    ]);
  });

  it("an empty period returns zeros and nulls, never an error", async () => {
    const r = await rpc("get_sales_invoicing", E1, "2024-01-01", "2024-01-31");
    expect(n(r.kpis.invoiced)).toBe(0);
    expect(r.kpis.customerTop5Pct).toBeNull();
    expect(r.kpis.topGroupName).toBeNull();
    expect(r.topCustomers).toEqual([]);
  });

  it("staff are scoped to themselves on every tab", async () => {
    const s = await rpc("get_sales_summary", E2, ...MAY, E1); // asks for Ali
    expect(n(s.kpis.invoiced)).toBe(500); // gets Bob's own
    expect(s.meta.salesRepCode).toBe(2);
  });

  it("an unmapped salesperson is flagged, with zeros on the SAP side", async () => {
    const s = await rpc("get_sales_summary", E1, ...MAY, E3);
    expect(s.meta.mappingMissing).toBe(true);
    expect(n(s.kpis.invoiced)).toBe(0);
  });
});
