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
  "sales_report_briefs.sql",
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
    create table employees (id uuid primary key, profile_id uuid, full_name text);
    create view employees_public as select id, profile_id, full_name from employees;

    create table sap_customers (customer_code text primary key, customer_name text, local_export_flag text);
    create table sap_sales_persons (sales_rep_code bigint primary key, sales_rep_name text);
    create table employee_sales_rep_mapping (sales_rep_code bigint primary key, employee_id uuid unique);
    create table sap_invoices (
      doc_entry bigint primary key, invoice_date text, is_cancelled text,
      customer_code text, customer_name text, sales_rep_code bigint,
      total_amount numeric, total_amount_myr numeric, gross_profit numeric, paid_to_date numeric,
      tax_amount numeric default 0, due_date text, status_code text default 'O');
    create view sap_invoices_with_balance as
      select i.*, (i.total_amount_myr - i.paid_to_date) as outstanding_balance from sap_invoices i;
    create table sap_items (item_code text primary key, item_name text, item_group_code bigint, sales_uom text, inventory_uom text);
    create table sap_item_groups (group_code bigint primary key, group_name text);
    create table sap_invoice_lines (doc_entry bigint, line_num bigint, item_code text, quantity numeric, line_total numeric);
    create table sap_sales_orders (
      doc_entry bigint primary key, order_date text, is_cancelled text,
      customer_code text, sales_rep_code bigint, total_amount_myr numeric, customer_ref text);
    create table sap_payments (doc_entry bigint primary key, payment_date text, is_cancelled text);
    create table sap_payment_applications (doc_entry bigint, payment_ref bigint, inv_type bigint, amount_applied_myr numeric);
    create table clients (id uuid primary key, name text);
    create table sales_leads (
      id uuid primary key, stage text, is_cancelled boolean, updated_at timestamptz,
      lead_owner_id uuid, client_id uuid, sap_customer_code text, product_type text,
      lead_source_type_id bigint, actual_revenue numeric,
      is_on_hold boolean default false, close_probability numeric, expected_revenue numeric,
      created_at timestamptz default '2025-01-01', lose_reason_id bigint, po_number text);
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

    -- RECENT RUN RATE: 1100 invoiced (fully paid) in each of the 3 complete
    --   months before this one -> 1100 a month. Dated by the database's own
    --   current_date so the fixture never drifts.
    insert into sap_invoices
      select 100 + k,
             to_char(date_trunc('month', current_date) - (k || ' months')::interval + interval '14 days', 'YYYY-MM-DD'),
             'N', 'C1', 'Acme Sdn Bhd', 1, 1100, 1100, 0, 1100
      from generate_series(1, 3) k;

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

    -- ── Added 2026-10-23 (final build) ──────────────────────────────────
    update employees set full_name = case id
      when '${E1}' then 'Ali' when '${E2}' then 'Bob' when '${E3}' then 'Cara' else 'Dan' end;

    -- RECEIVABLES, Finance's rule (status O, balance > 0.01), aged from
    -- TODAY. Open balances: 1 = 600 due 10 days ago (1-30), 4 = 300 due 100
    -- days ago (90+, critical), 5 = 600 due in 5 days (not yet due), 6 = 50
    -- with no due date (not yet due), 7 = 100 due 45 days ago (31-60).
    --   Outstanding 1650, overdue 1000 (3 invoices), critical 300 (1).
    -- Invoice 200 still owes 400 but is CLOSED in SAP: Finance does not
    -- count it, so neither does Sales.
    update sap_invoices set due_date = to_char(current_date - 10,  'YYYY-MM-DD') where doc_entry = 1;
    update sap_invoices set due_date = to_char(current_date - 100, 'YYYY-MM-DD') where doc_entry = 4;
    update sap_invoices set due_date = to_char(current_date + 5,   'YYYY-MM-DD') where doc_entry = 5;
    update sap_invoices set due_date = to_char(current_date - 45,  'YYYY-MM-DD') where doc_entry = 7;
    insert into sap_invoices values
      (200, '2025-03-15', 'N', 'C2', 'Beta Ltd', 1, 400, 400, 40, 0, 0, '2025-04-15', 'C');
    -- Aging boundaries, on rep 9 (dated 2023 so no tested window sees them):
    --   201 due today = 0 days (not due), 202 = 1 day (1-30),
    --   203 = 90 days (61-90, overdue but NOT critical), 204 = 91 (90+, critical).
    insert into sap_invoices values
      (201, '2023-06-01', 'N', 'C3', 'Cosmo', 9, 10, 10, 1, 0, 0, to_char(current_date,      'YYYY-MM-DD'), 'O'),
      (202, '2023-06-01', 'N', 'C3', 'Cosmo', 9, 10, 10, 1, 0, 0, to_char(current_date - 1,  'YYYY-MM-DD'), 'O'),
      (203, '2023-06-01', 'N', 'C3', 'Cosmo', 9, 10, 10, 1, 0, 0, to_char(current_date - 90, 'YYYY-MM-DD'), 'O'),
      (204, '2023-06-01', 'N', 'C3', 'Cosmo', 9, 10, 10, 1, 0, 0, to_char(current_date - 91, 'YYYY-MM-DD'), 'O');

    -- GROSS MARGIN, May: invoice 1 carries RM100 tax (900 before tax).
    --   Known GP 200 + 50 + 30 = 280 on 900 + 500 + 300 = 1700 before tax
    --   -> 16.5%. Invoice 7's GP is an outlier (unknown): coverage =
    --   1800 / 1900 of Invoiced Revenue = 94.7%.
    update sap_invoices set tax_amount = 100 where doc_entry = 1;

    -- RUN RATE ORDERS: 1650 booked in each of the 3 complete months before
    --   this one (4950) against 3300 invoiced -> Order-to-Invoice 1.5.
    insert into sap_sales_orders
      select 110 + k,
             to_char(date_trunc('month', current_date) - (k || ' months')::interval + interval '9 days', 'YYYY-MM-DD'),
             'N', 'C1', 1, 1650, null
      from generate_series(1, 3) k;

    -- PENDING SAP ORDER ENTRY: L2 (won, PO-2) has its SAP order (order 11);
    --   L5 (won, PO-5) has none -> pending, RM1000; L3 (PO-3, no order) is
    --   cancelled, so it is not a won lead and not pending.
    update sales_leads set po_number = 'PO-2' where id = 'a0000000-0000-0000-0000-000000000002';
    update sales_leads set po_number = 'PO-5' where id = 'a0000000-0000-0000-0000-000000000005';
    update sales_leads set po_number = 'PO-3' where id = 'a0000000-0000-0000-0000-000000000003';
    update sap_sales_orders set customer_ref = 'PO-2' where doc_entry = 11;

    -- PIPELINE GENERATED, May: L6 was created on 5 May (Malaysia time),
    --   expected 10000. Every other lead was created on 1 Jan 2025.
    update sales_leads set created_at = '2025-05-05 02:00+00' where id = 'a0000000-0000-0000-0000-000000000006';

    -- UNMAPPED OWNER: Cara (E3, no SAP rep) won L8, RM700, on 10 June 2025.
    insert into sales_leads (id, stage, is_cancelled, updated_at, lead_owner_id, client_id, product_type, lead_source_type_id, actual_revenue) values
      ('a0000000-0000-0000-0000-000000000008', 'WON', false, '2025-06-10 03:00+00', '${E3}', '${CLIENT}', 'OIL', 1, 700);

    -- PIPELINE COVERAGE: Ali has a 1000 target in every month from this one
    --   to the end of this fiscal year.
    insert into sales_targets
      select '${E1}', m::date, 1000
      from generate_series(date_trunc('month', current_date),
                           fiscal_year_start(current_date) + interval '11 months',
                           interval '1 month') m;
  `);
});

describe("1. definitions (fact views)", () => {
  it("invoices: cancelled excluded, empty date kept as null, canonical customer name", async () => {
    const rows = await q("select doc_entry, invoice_date::text, customer_name from sales_invoice_facts where doc_entry < 100 order by doc_entry");
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

  it("receivables: Finance's open-invoice rule, aged from today", async () => {
    const rows = await q("select doc_entry, outstanding_myr, days_past_due from sales_receivable_facts where doc_entry < 200 order by doc_entry");
    // 1: 1000-400, 4: 300, 5: 700-100, 6: 50, 7: 100. Invoice 2 is fully paid;
    // 3 cancelled; 200 still owes 400 but is CLOSED in SAP (Finance's rule).
    expect(rows.map((r) => [Number(r.doc_entry), n(r.outstanding_myr), r.days_past_due])).toEqual([
      [1, 600, 10],
      [4, 300, 100],
      [5, 600, -5],
      [6, 50, null], // no due date: not known to be late
      [7, 100, 45],
    ]);
  });

  it("won deals: cancelled excluded, close date taken in Malaysia time", async () => {
    const rows = await q("select won_myr, closed_on::text from sales_won_lead_facts order by won_myr");
    expect(rows.map((r) => [n(r.won_myr), r.closed_on])).toEqual([
      [700, "2025-06-10"], // Cara's (unmapped owner)
      [1000, "2025-05-20"], // no history row: falls back to updated_at
      [2000, "2025-05-10"],
      [5000, "2025-06-01"], // 2025-05-31 20:00 UTC is 1 June in Malaysia
    ]);
  });

  it("invoices: revenue before tax subtracts SAP's tax (both MYR)", async () => {
    const [r] = await q("select invoiced_myr, invoiced_before_tax_myr from sales_invoice_facts where doc_entry = 1");
    expect([n(r.invoiced_myr), n(r.invoiced_before_tax_myr)]).toEqual([1000, 900]);
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
      ["8", "won", "2025-06-10", null],
    ]);
    // sales_won_lead_facts is exactly the 'won' rows.
    const [{ k }] = await q("select count(*)::int as k from sales_won_lead_facts");
    expect(k).toBe(4);
  });

  it("leads: Pending SAP Order Entry = won (not cancelled), PO with no SAP order", async () => {
    const rows = await q("select right(lead_id::text, 1) as l, pending_sap_order from sales_lead_facts where po_number is not null order by lead_id");
    expect(rows.map((r) => [r.l, r.pending_sap_order])).toEqual([
      ["2", false], // SAP order 11 carries PO-2
      ["3", false], // cancelled: not a won lead
      ["5", true],
    ]);
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
    // Generated in May: L6 only. Pending SAP Order Entry is today: L5.
    expect([n(all.generated_value), n(all.generated_count)]).toEqual([10000, 1]);
    expect([n(all.pending_sap_value), n(all.pending_sap_count)]).toEqual([1000, 1]);
  });

  it("Pipeline Coverage: Active Pipeline / Pipeline Target left this FY", async () => {
    const [c] = await q("select * from sales_pipeline_coverage($1)", [E1]);
    const [{ left }] = await q(`select months_spanned(current_date + 1,
      (fiscal_year_start(current_date) + interval '1 year' - interval '1 day')::date) * 1000 as left`);
    expect(n(c.active_value)).toBe(10000);
    expect(n(c.target_remaining)).toBeCloseTo(n(left), 6);
    expect(n(c.coverage)).toBe(Math.round((10000 / n(left)) * 10) / 10);
    // No target left (Bob has none): null, never infinite.
    const [b] = await q("select * from sales_pipeline_coverage($1)", [E2]);
    expect(b.coverage).toBeNull();
  });

  it("order book: TODAY, whatever window -- with Open Backlog (Months)", async () => {
    const [b] = await q("select * from sales_order_book_totals(null)");
    expect([n(b.open_value), n(b.open_orders), n(b.overdue_value), n(b.unbilled_value)]).toEqual([3300, 3, 2000, 500]);
    expect([n(b.recent_monthly_invoiced), n(b.backlog_months)]).toEqual([1100, 3]);
  });

  it("receivables: outstanding, overdue, critical and aging add up", async () => {
    const [all] = await q("select * from sales_receivable_totals(null, null)");
    // 1650 from section 1 + rep 9's four RM10 invoices.
    expect([n(all.outstanding), n(all.invoices), n(all.customers)]).toEqual([1690, 9, 3]);
    // Overdue: 1 (600) + 4 (300) + 7 (100) + 202, 203, 204 (30).
    expect([n(all.overdue_value), n(all.overdue_count)]).toEqual([1030, 6]);
    // Critical (> 90 days): 4 (300) + 204 (10). 203 at exactly 90 is not.
    expect([n(all.critical_value), n(all.critical_count)]).toEqual([310, 2]);
    const buckets = [all.not_due, all.d1_30, all.d31_60, all.d61_90, all.d90_plus].map(n);
    expect(buckets).toEqual([660, 610, 100, 10, 310]);
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(n(all.outstanding));
    const [r9] = await q("select * from sales_receivable_totals(9, null)");
    expect([n(r9.not_due), n(r9.d1_30), n(r9.d61_90), n(r9.d90_plus)]).toEqual([10, 10, 10, 10]);
  });

  it("ar_dso is Finance's formula", async () => {
    const [r] = await q(`select ar_dso(1000, 600, 300, 90) as a,
                                ar_dso(100, 600, 0, 90) as clamped,
                                ar_dso(100, 0, 0, 90) as none`);
    // ((max(1000 - 600 + 300, 0) + 1000) / 2) / 600 * 90 = 127.5
    expect(n(r.a)).toBe(127.5);
    expect(n(r.clamped)).toBe(7.5); // beginning AR clamps to 0
    expect(r.none).toBeNull();
  });

  it("gross margin: known GP only, before tax, with its coverage", async () => {
    const [g] = await q("select * from sales_gross_margin(null, $1, $2)", MAY);
    expect([n(g.gross_profit), n(g.margin_pct), n(g.coverage_pct)]).toEqual([280, 16.5, 94.7]);
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

describe("report_last_year and months_spanned", () => {
  it.each([
    ["2025-05-01", "2025-05-31", "2024-05-01", "2024-05-31"], // month
    ["2029-02-01", "2029-02-28", "2028-02-01", "2028-02-29"], // whole month -> whole leap Feb
    ["2028-02-01", "2028-02-29", "2027-02-01", "2027-02-28"],
    ["2025-04-01", "2026-03-31", "2024-04-01", "2025-03-31"], // fiscal year
    ["2025-01-15", "2025-01-21", "2024-01-15", "2024-01-21"], // custom days
  ])("%s → %s", async (s, e, ls, le) => {
    const [r] = await q("select ly_start::text, ly_end::text from report_last_year($1, $2)", [s, e]);
    expect([r.ly_start, r.ly_end]).toEqual([ls, le]);
  });

  it("a period still running is cut to the same days last year", async () => {
    const [r] = await q(`
      select ly.ly_start::text = (date_trunc('month', current_date) - interval '1 year')::date::text as start_ok,
             ly.ly_end::text = (current_date - interval '1 year')::date::text as end_ok
      from report_last_year(null, null) ly`);
    expect([r.start_ok, r.end_ok]).toEqual([true, true]);
  });

  it("months_spanned counts part-months by their days", async () => {
    const [r] = await q(`select months_spanned('2026-10-01', '2026-10-31') as full_month,
                                months_spanned('2026-10-24', '2027-03-31') as rest_of_fy,
                                months_spanned('2026-11-01', '2026-10-31') as empty`);
    expect(n(r.full_month)).toBe(1);
    expect(n(r.rest_of_fy)).toBeCloseTo(5 + 8 / 31, 6);
    expect(n(r.empty)).toBe(0);
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
    // The CRM side of the scorecard adds up to Pipeline's totals.
    expect(teamSum("won")).toBe(n(pipeline.kpis.won));
    expect(teamSum("target")).toBe(n(pipeline.kpis.target));
  });

  it("summary: Open Position is each tab's own TODAY figure", () => {
    const o = summary.openPosition;
    expect(n(o.activePipeline)).toBe(n(pipeline.kpis.openValue));
    expect(n(o.weightedPipeline)).toBe(n(pipeline.kpis.weightedValue));
    expect(n(o.pipelineCoverage)).toBe(n(pipeline.kpis.pipelineCoverage));
    expect(n(o.openBacklog)).toBe(n(orders.kpis.orderBookValue));
    expect(n(o.openBacklogMonths)).toBe(n(orders.kpis.openBacklogMonths));
    expect(n(o.outstanding)).toBe(n(collections.kpis.outstanding));
    expect(n(o.overdue)).toBe(n(collections.kpis.overdueValue));
    expect(n(o.criticallyOverdue)).toBe(n(collections.kpis.criticalValue));
    expect([n(o.openBacklog), n(o.outstanding)]).toEqual([3300, 1690]);
  });

  it("summary: cumulative FY to date, ending at FY to date", () => {
    const c = summary.fyCumulative;
    expect(c).toHaveLength(12);
    expect([c[0].period, n(c[0].invoiced), n(c[0].budget)]).toEqual(["2025-04", 700, 3000]);
    expect([c[1].period, n(c[1].invoiced), n(c[1].budget), c[1].inPeriod]).toEqual(["2025-05", 2600, 6720, true]);
    expect(n(c[1].invoiced)).toBe(n(summary.fyProgress.fytdInvoiced)); // as of 31 May
    expect(n(c[11].budget)).toBe(n(summary.fyProgress.fyBudget));
  });

  it("summary: Pipeline Won is null for fiscal years before the CRM existed", () => {
    // First lead created 1 Jan 2025 -> FY 2024-2025.
    const byName = Object.fromEntries(summary.orderToCashYoY.map((y) => [y.name, y]));
    expect(byName["2023-2024"].won).toBeNull();
    expect(n(byName["2024-2025"].won)).toBe(0);
  });

  it("summary: period, comparison (April) and attainment", () => {
    expect(summary.meta.period).toEqual({ startDate: "2025-05-01", endDate: "2025-05-31", hasPeriod: true });
    expect(summary.meta.comparisonWindow).toEqual({ startDate: "2025-04-01", endDate: "2025-04-30", isPartial: false });
    expect(summary.meta.trendWindow).toEqual({ startDate: "2025-04-01", endDate: "2026-03-31" });
    expect(n(summary.kpis.prevInvoiced)).toBe(700);
    expect(n(summary.kpis.budgetAttainmentPct)).toBe(51); // 1900 / 3720
    expect(n(summary.kpis.targetAttainmentPct)).toBe(60); // 3000 / 5000
  });

  it("summary: Order-to-Cash YoY sums the same monthly series per fiscal year", () => {
    expect(summary.orderToCashYoY).toHaveLength(10);
    const fy25 = summary.orderToCashYoY.find((y) => y.name === "2025-2026");
    // won: May 3000 + L1 5000 (1 June) + Cara's L8 700 (10 June)
    expect([n(fy25.invoiced), n(fy25.booked), n(fy25.collected), n(fy25.won)]).toEqual([2600, 3800, 1000, 8700]);
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
    expect(invoicing.topCustomers.map((c) => [c.customerCode, n(c.invoiced)])).toEqual([
      ["C1", 1500],
      ["C2", 300],
      ["C3", 100],
    ]);
    expect([n(k.grossProfit), n(k.grossMarginPct), n(k.gpCoveragePct)]).toEqual([280, 16.5, 94.7]);
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
    expect([n(k.generated), n(k.generatedCount), n(k.pendingSapValue), n(k.pendingSapCount)]).toEqual([10000, 1, 1000, 1]);
  });

  it("orders: bookings, ratios, and the order book is TODAY whatever the period", async () => {
    const k = orders.kpis;
    expect([n(k.booked), n(k.orderCount), n(k.bookToBill), n(k.prevBookToBill)]).toEqual([3800, 3, 2, 0]);
    // Last 3 complete months: 4950 booked / 3300 invoiced.
    expect(n(k.recentBookToBill)).toBe(1.5);
    expect([n(k.orderBookValue), n(k.orderBookOrders), n(k.overdueValue), n(k.unbilledValue)]).toEqual([3300, 3, 2000, 500]);
    expect(orders.topCustomers.map((c) => [c.customerCode, n(c.value)])).toEqual([["C1", 2800], ["C2", 1000]]);
    // No period: the same book.
    const all = await rpc("get_sales_orders", E1, null, null);
    expect([n(all.kpis.orderBookValue), n(all.kpis.overdueOrders), n(all.kpis.unbilledValue), n(all.kpis.openBacklogMonths)])
      .toEqual([3300, 1, 500, 3]);
  });

  it("collections: payers, and receivables are TODAY on Finance's rule", async () => {
    const k = collections.kpis;
    expect(collections.topPayers.map((p) => [p.customerCode, n(p.value)])).toEqual([
      ["C1", 900],
      ["C2", 100],
    ]);
    expect([n(k.outstanding), n(k.overdueValue), n(k.overdueCount), n(k.criticalValue), n(k.overduePct)])
      .toEqual([1690, 1030, 6, 310, 60.9]);
    expect(k.collectionRatePct).toBeUndefined(); // retired
    const ages = collections.overdueByAge.map((a) => [a.name, n(a.value)]);
    expect(ages).toEqual([
      ["Not Yet Due", 660],
      ["1–30 days", 610],
      ["31–60 days", 100],
      ["61–90 days", 10],
      ["90+ days", 310],
    ]);
    expect(collections.topOverdue.map((c) => [c.customerCode, n(c.value), n(c.critical)])).toEqual([
      ["C1", 600, 0],
      ["C2", 300, 300],
      ["C3", 130, 10],
    ]);
    // DSO wiring: Finance's formula on today's receivables and the last 90 days.
    const [{ dso }] = await q(`select ar_dso(1690, t.invoiced, t.collected, 90) as dso
      from sales_totals(null, null, current_date - 89, current_date) t`);
    expect(n(k.dso)).toBe(n(dso));
    // No period: identical.
    const all = await rpc("get_sales_collections", E1, null, null);
    expect(n(all.kpis.outstanding)).toBe(1690);
    expect(all.meta.period.hasPeriod).toBe(false);
  });

  it("team: per-rep rows with null (not 0) where there's nothing to divide by", () => {
    const rows = Object.fromEntries(team.scorecard.map((r) => [r.name, r]));
    expect(n(rows.Ali.attainmentPct)).toBe(35); // 1100 / 3100
    expect(rows.Ali.avatarUrl).toBe("ali.png");
    expect(rows.Unassigned.attainmentPct).toBeNull(); // no budget
    expect(n(rows.Unassigned.invoiced)).toBe(300);
    // CRM line: Ali won 2000 of 4000 (L2 won, L3 cancelled -> lost), Bob 1000 of 1000.
    expect([n(rows.Ali.won), n(rows.Ali.targetAttainmentPct), n(rows.Ali.winRatePct)]).toEqual([2000, 50, 50]);
    expect([n(rows.Bob.won), n(rows.Bob.targetAttainmentPct), n(rows.Bob.winRatePct)]).toEqual([1000, 100, 50]);
    // TODAY: Ali has 2000 overdue delivery and 700 overdue receivables; Bob 500
    // delivered-not-invoiced; the 300 critical invoice has no rep.
    expect([n(rows.Ali.overdueDeliveryValue), n(rows.Ali.overdueValue), n(rows.Ali.criticalValue)]).toEqual([2000, 700, 0]);
    expect(n(rows.Bob.unbilledValue)).toBe(500);
    expect(n(rows.Unassigned.criticalValue)).toBe(300);
    expect(team.grossProfitByRep.map((r) => [r.name, n(r.invoiced), n(r.grossProfit)])).toEqual([
      ["Ali", 1100, 200], // invoice 7's outlier GP is unknown, not summed
      ["Bob", 500, 50],
      ["Unassigned", 300, 30],
    ]);
    // Overdue by Rep adds up to the Collections tile.
    const overdueSum = team.overdueByRep.reduce((s, r) => s + n(r.overdue), 0);
    expect(overdueSum).toBe(n(collections.kpis.overdueValue));
  });

  it("team: a salesperson with no SAP rep still gets a row, and won adds up", async () => {
    const june = await rpc("get_sales_team", E1, "2025-06-01", "2025-06-30");
    const cara = june.scorecard.find((r) => r.name === "Cara");
    expect([n(cara.won), cara.invoiced, cara.salesRepCode]).toEqual([700, null, null]);
    const [all] = await q("select won from sales_pipeline_totals(null, '2025-06-01', '2025-06-30')");
    const wonSum = june.scorecard.reduce((s, r) => s + (n(r.won) ?? 0), 0);
    expect(wonSum).toBe(n(all.won)); // 5000 + 700
  });

  it("an empty period returns zeros and nulls, never an error", async () => {
    const r = await rpc("get_sales_invoicing", E1, "2024-01-01", "2024-01-31");
    expect(n(r.kpis.invoiced)).toBe(0);
    expect(r.kpis.customerTop5Pct).toBeNull();
    expect(r.kpis.topGroupName).toBeNull();
    expect(r.topCustomers).toEqual([]);
  });

  it("summary: Fiscal Year Progress for May 2025", () => {
    // FY 2025-2026, measured to the end of May: invoiced Apr 700 + May 1900;
    // budget Apr 3000 + May 3720 (no later budget rows), so the whole-FY
    // budget is 6720 and 4120 is left over the 10 remaining months.
    expect(summary.kpis.lastYearInvoiced).toBe(0);
    const f = summary.fyProgress;
    expect([f.fyStart, f.fyEnd, f.asOf]).toEqual(["2025-04-01", "2026-03-31", "2025-05-31"]);
    expect([n(f.fytdInvoiced), n(f.fytdBudget), n(f.fytdAttainmentPct), n(f.fyBudget)]).toEqual([2600, 6720, 39, 6720]);
    expect([n(f.budgetRemaining), n(f.monthsElapsed), n(f.monthsLeft)]).toEqual([4120, 2, 10]);
    expect([n(f.monthlyAverage), n(f.monthlyNeeded)]).toEqual([1300, 412]);
  });

  it("Same Period Last Year: May 2026 compares with May 2025 on every tab", async () => {
    const may26 = ["2026-05-01", "2026-05-31"];
    const s = await rpc("get_sales_summary", E1, ...may26);
    expect(s.meta.lastYearWindow).toEqual({ startDate: "2025-05-01", endDate: "2025-05-31" });
    expect([n(s.kpis.lastYearWon), n(s.kpis.lastYearBooked), n(s.kpis.lastYearInvoiced), n(s.kpis.lastYearCollected)])
      .toEqual([3000, 3800, 1900, 1000]);
    const pl = await rpc("get_sales_pipeline", E1, ...may26);
    expect([n(pl.kpis.lastYearWon), n(pl.kpis.lastYearLost)]).toEqual([3000, 12000]);
    const o = await rpc("get_sales_orders", E1, ...may26);
    expect(n(o.kpis.lastYearBooked)).toBe(3800);
    const iv = await rpc("get_sales_invoicing", E1, ...may26);
    expect(n(iv.kpis.lastYearInvoiced)).toBe(1900);
    const c = await rpc("get_sales_collections", E1, ...may26);
    expect(n(c.kpis.lastYearCollected)).toBe(1000);
  });

  it("pipeline: Pipeline Cycle is the average days from lead to won", () => {
    // L2 created 1 Jan, won 10 May = 129 days; L5 created 1 Jan, won 20 May = 139.
    expect(n(pipeline.kpis.avgDaysToWon)).toBe(134);
  });

  it("orders: Open Backlog (Months) against the last 3 complete months", async () => {
    const all = await rpc("get_sales_orders", E1, null, null);
    expect(n(all.kpis.recentMonthlyInvoiced)).toBe(1100);
    expect(n(all.kpis.openBacklogMonths)).toBe(3); // 3300 open / 1100 a month
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

describe("5. Meeting Brief storage is exactly as private as the report", () => {
  // Run as the `authenticated` role so RLS applies (the test superuser
  // bypasses it), with the stub tables readable as they are in Supabase.
  const asUser = async (who, sql, params) => {
    await db.exec(`
      grant usage on schema public, auth to authenticated;
      grant select on all tables in schema public to authenticated;
      grant execute on all functions in schema auth to authenticated;`);
    return as(who, async () => {
      await db.exec("set role authenticated");
      try {
        return await q(sql, params);
      } finally {
        await db.exec("reset role");
      }
    });
  };
  const insert = (who, owner) =>
    asUser(
      who,
      `insert into sales_report_briefs (period_start, period_end, owner_id, figures, brief_text)
       values ('2025-05-01', '2025-05-31', $1, '{}', 'brief') returning id`,
      [owner],
    );

  it("a manager can write briefs for everyone and for any salesperson", async () => {
    await insert(E1, null);
    await insert(E1, E2);
    await insert(E1, E1);
    const rows = await asUser(E1, "select owner_id from sales_report_briefs order by owner_id nulls first");
    expect(rows.map((r) => r.owner_id)).toEqual([null, E1, E2]);
  });

  it("staff see and write only their own brief", async () => {
    const rows = await asUser(E2, "select owner_id from sales_report_briefs");
    expect(rows.map((r) => r.owner_id)).toEqual([E2]);
    await expect(insert(E2, E1)).rejects.toThrow(/row-level security/);
    await expect(insert(E2, null)).rejects.toThrow(/row-level security/);
  });

  it("outside Sales / Management: nothing to read, nothing to write", async () => {
    expect(await asUser(E4, "select * from sales_report_briefs")).toEqual([]);
    await expect(insert(E4, null)).rejects.toThrow(/row-level security/);
  });

  it("one brief per period and salesperson", async () => {
    await expect(insert(E1, null)).rejects.toThrow(/sales_report_briefs_key/);
  });
});
