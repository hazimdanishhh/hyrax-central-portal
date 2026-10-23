// ⚠ PARKED 2026-10-23 -- NOT DEPLOYED. Do not deploy until the brief is
// made reusable across reports and fed every tab's figures (see
// src/pages/user/sales/reports/tabs/MeetingBrief.jsx and
// docs/portal/DASHBOARD-ROADMAP.md §2.1). Needs sales_report_briefs.sql
// (also not run) before it can work.
//
// generate-sales-meeting-brief -- the AI Meeting Brief on Sales Reports'
// Summary tab (2026-10-23). Plan: docs/sales/SALES-REPORTS-TABS-PLAN.md
// (final build §5). Stores into public.sales_report_briefs
// (supabase/sql_editor/sales_report_briefs.sql).
//
// SECURITY -- the opposite of generate-ai-summary.ts, on purpose:
//   * NO service role. The Supabase client carries the CALLER'S token, so
//     the report RPCs' own guard (sales_report_scope: SAL / MGM only, staff
//     forced to their own data) and the briefs table's RLS both apply. A
//     caller can only get a brief of figures they could already see.
//   * The Gemini key goes in a header, never the URL (URLs end up in logs).
//   * One brief per (period, salesperson), REPLACED on regenerate, and not
//     regenerated within 10 minutes of the last one (cost and spam guard).
//
// GROUNDING: the model gets a small, labelled set of figures -- already
// formatted ("RM 1,234,567", "62%") -- taken from the same tab RPCs the page
// shows, and is told to use only those. The figures are stored with the
// brief so any sentence can be checked against its source.
//
// Deploy: supabase functions deploy generate-sales-meeting-brief
// Secrets: GEMINI_API_KEY (already set for generate-ai-summary).
// SUPABASE_URL / SUPABASE_ANON_KEY are provided by Supabase.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-2.5-flash";
const REGENERATE_AFTER_MINUTES = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

// deno-lint-ignore no-explicit-any
type Json = any;

const rm = (v: Json) =>
  v === null || v === undefined
    ? "not available"
    : `RM ${Math.round(Number(v)).toLocaleString("en-US")}`;
const pct = (v: Json) =>
  v === null || v === undefined ? "not available" : `${v}%`;
const change = (cur: Json, prev: Json) => {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return "not available";
  if (Number(prev) === 0) return Number(cur) === 0 ? "no change" : "not comparable (was zero)";
  const d = Math.round(((Number(cur) - Number(prev)) / Math.abs(Number(prev))) * 100);
  return `${d >= 0 ? "+" : ""}${d}%`;
};

// The figures the brief may use: labelled exactly as on the page, each with
// its window. Built from the tab RPCs' own JSON -- nothing is recomputed.
function buildFigures(summary: Json, pipeline: Json, orders: Json, collections: Json) {
  const k = summary.kpis;
  const fy = summary.fyProgress;
  const op = summary.openPosition;
  const p = pipeline.kpis;
  const o = orders.kpis;
  const c = collections.kpis;
  const period = summary.meta.period;
  const prev = summary.meta.comparisonWindow;
  const ly = summary.meta.lastYearWindow;

  const shortfalls = (summary.budgetBridge ?? [])
    .filter((r: Json) => Number(r.budget) > 0 && Number(r.invoiced) < Number(r.budget))
    .map((r: Json) => ({ name: r.name, gap: Number(r.invoiced) - Number(r.budget) }))
    .sort((a: Json, b: Json) => a.gap - b.gap)
    .slice(0, 3)
    .map((r: Json) => `${r.name}: ${rm(r.gap)} vs budget`);

  return {
    windows: {
      period: `${period.startDate} to ${period.endDate}`,
      comparedWith: `${prev.startDate} to ${prev.endDate}`,
      samePeriodLastYear: `${ly.startDate} to ${ly.endDate}`,
      fiscalYear: `${fy.fyStart} to ${fy.fyEnd}, measured to ${fy.asOf}`,
      openBalances: "today",
    },
    periodResults: {
      "Pipeline Won": `${rm(k.won)}; ${pct(k.targetAttainmentPct)} of Pipeline Target (${rm(k.target)}); ${change(k.won, k.prevWon)} vs comparison; last year ${rm(k.lastYearWon)}`,
      "Pipeline Generated": `${rm(p.generated)} from ${p.generatedCount} leads created; ${change(p.generated, p.prevGenerated)} vs comparison`,
      "Win Rate": `${pct(p.winRatePct)} (previously ${pct(p.prevWinRatePct)})`,
      "Lost Revenue": rm(p.lost),
      "Sales Orders": `${rm(k.booked)}; ${change(k.booked, k.prevBooked)} vs comparison; last year ${rm(k.lastYearBooked)}`,
      "Order-to-Invoice Ratio": `${o.bookToBill ?? "not available"}x this period; ${o.recentBookToBill ?? "not available"}x over the last 3 complete months`,
      "Invoiced Revenue": `${rm(k.invoiced)}; ${pct(k.budgetAttainmentPct)} of Revenue Budget (${rm(k.budget)}); ${change(k.invoiced, k.prevInvoiced)} vs comparison; last year ${rm(k.lastYearInvoiced)}`,
      "Payments Collected": `${rm(k.collected)}; ${change(k.collected, k.prevCollected)} vs comparison; last year ${rm(k.lastYearCollected)}`,
    },
    fiscalYear: {
      "Invoiced Revenue - FY to Date": `${rm(fy.fytdInvoiced)}; ${pct(fy.fytdAttainmentPct)} of the budget to date (${rm(fy.fytdBudget)})`,
      "Revenue Budget - Full FY": rm(fy.fyBudget),
      "Monthly Invoicing Needed": `${rm(fy.monthlyNeeded)} a month for ${fy.monthsLeft} months, against a monthly average so far of ${rm(fy.monthlyAverage)}`,
      "Largest budget shortfalls by rep": shortfalls.length ? shortfalls : ["none"],
    },
    openToday: {
      "Active Pipeline": `${rm(op.activePipeline)} (weighted ${rm(op.weightedPipeline)}); Pipeline Coverage ${op.pipelineCoverage ?? "not available"}x of the target left this fiscal year`,
      "Pending SAP Order Entry": `${rm(p.pendingSapValue)} on ${p.pendingSapCount} won leads`,
      "Open Backlog": `${rm(op.openBacklog)} on ${op.openBacklogOrders} orders; ${op.openBacklogMonths ?? "not available"} months of invoicing`,
      "Overdue Delivery": rm(o.overdueValue),
      "Delivered, Not Invoiced": rm(o.unbilledValue),
      "Outstanding Invoices": `${rm(c.outstanding)}; DSO ${c.dso ?? "not available"} days`,
      Overdue: `${rm(c.overdueValue)} (${pct(c.overduePct)} of outstanding); critically overdue (90+ days) ${rm(c.criticalValue)}`,
    },
  };
}

const SYSTEM_INSTRUCTION = `You write the opening brief for a sales management meeting, from a fixed set of figures.

RULES
1. Use ONLY the figures given, exactly as written (they are already formatted). Never compute new numbers, never round differently, never guess a figure that says "not available".
2. Do not state causes the figures do not show. Where the figures point to a question, ask it.
3. Name the window of every figure you cite when it is not the selected period (e.g. "FY to date", "today").
4. Plain English, no hype, no greeting, no closing line. At most 170 words.

FORMAT -- exactly these three markdown headers, two bullets under each:
### What happened
### Why
### What's coming and the risks`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Not signed in" }, 401);

  try {
    // The caller's own session: every query below runs as them.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );

    const { startDate = null, endDate = null, owner = null } =
      await req.json().catch(() => ({}));
    const args = { p_start_date: startDate, p_end_date: endDate, p_owner_id: owner };

    // Raises 'Access denied' for anyone outside Sales Reports; resolves a
    // staff user to themselves -- the brief is keyed by the EFFECTIVE owner.
    const { data: scope, error: scopeError } = await supabase.rpc(
      "sales_report_scope",
      { p_owner_id: owner },
    );
    if (scopeError) return json({ error: scopeError.message }, 403);
    const effectiveOwner = scope?.[0]?.owner_id ?? null;

    const [summary, pipeline, orders, collections] = await Promise.all(
      ["get_sales_summary", "get_sales_pipeline", "get_sales_orders", "get_sales_collections"].map(
        async (fn) => {
          const { data, error } = await supabase.rpc(fn, args);
          if (error) throw error;
          return data;
        },
      ),
    );

    const period = summary.meta.period;

    // Cost / spam guard: a brief this fresh is returned as it is.
    const { data: existing } = await supabase
      .from("sales_report_briefs")
      .select("*")
      .eq("period_start", period.startDate)
      .eq("period_end", period.endDate)
      .filter("owner_id", effectiveOwner ? "eq" : "is", effectiveOwner ?? null)
      .maybeSingle();
    if (
      existing &&
      Date.now() - new Date(existing.created_at).getTime() < REGENERATE_AFTER_MINUTES * 60_000
    ) {
      return json({ brief: existing, reused: true });
    }

    const figures = buildFigures(summary, pipeline, orders, collections);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")!,
        },
        body: JSON.stringify({
          system_instruction: { parts: { text: SYSTEM_INSTRUCTION } },
          contents: [
            { parts: [{ text: `FIGURES\n${JSON.stringify(figures, null, 2)}` }] },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      },
    );
    const geminiData = await geminiResponse.json();
    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiData?.error?.message ?? geminiResponse.status}`);
    }
    const briefText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!briefText) throw new Error("The model returned no text.");

    const { data: brief, error: saveError } = await supabase
      .from("sales_report_briefs")
      .upsert(
        {
          period_start: period.startDate,
          period_end: period.endDate,
          owner_id: effectiveOwner,
          figures,
          brief_text: briefText,
          model: MODEL,
          created_at: new Date().toISOString(),
        },
        { onConflict: "period_start,period_end,owner_key" },
      )
      .select()
      .single();
    if (saveError) throw saveError;

    return json({ brief, reused: false });
  } catch (error) {
    const message = (error as Error)?.message ?? String(error);
    return json({ error: message }, message.includes("Access denied") ? 403 : 500);
  }
});
