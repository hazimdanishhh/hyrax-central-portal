import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, filters = {} } = await req.json();

    if (!type) {
      throw new Error(
        'Missing \'type\' in request body. E.g., { "type": "leads" }',
      );
    }

    // 1. Extract dates. If missing, leave as null for "All-Time"
    let p_start_date = null;
    let p_end_date = null;

    if (filters.startDate && filters.endDate) {
      p_start_date = filters.startDate;
      p_end_date = filters.endDate;
    }

    let rpcName = "";
    let systemInstruction = "";

    // 2. Dynamic time context for the prompt
    const timeContext =
      p_start_date && p_end_date
        ? `from ${p_start_date} to ${p_end_date}`
        : `for the all-time historical pipeline`;

    switch (type) {
      case "leads":
        rpcName = "get_sales_leads_dashboard";

        // 3. The upgraded Multi-Audience Prompt
        systemInstruction = `You are an elite Chief Revenue Officer analyzing sales pipeline data ${timeContext}.
          Your goal is to provide a synthesis that serves both high-level Executives and operational Sales Managers, specifically designed to drive productive cross-functional meetings.

          RULE 1: Do NOT simply regurgitate the metrics. Do not write "Revenue is X and leads are Y." They can already see the charts. 
          RULE 2: Synthesize the 'Why' and the 'What Next'. 
          RULE 3: Tone must be crisp, ruthlessly objective, and strategic. Zero fluff. Maximum 250 words.

          Structure your response using EXACTLY these three markdown headers:

          ### Pipeline Health & Trajectory
          One to two sentences answering: Are we on track? Highlight the most critical macro-trend regarding target attainment, win-rate shifts, or revenue velocity.

          ### Funnel Diagnostics
          Provide two bullet points identifying the root causes:
          * **The Accelerator:** Highlight the biggest positive driver (e.g., a specific product, source, or rep driving disproportionate revenue). Use exact monetary values.
          * **The Bottleneck:** Expose the deepest leak in the funnel (e.g., deals stalling in a specific stage, dropping average deal size, or high forecast variance). Use exact numbers.

          ### Meeting Agenda: Action Items
          Provide two specific, data-backed directives or questions that the team MUST decide on in today's meeting to unblock revenue or replicate success. Tie these directly to the bottleneck or accelerator identified above.`;
        break;
      case "invoices":
        rpcName = "get_invoice_dashboard";
        systemInstruction = `You are a CFO analyzing accounts receivable ${timeContext}. Highlight overdue payments, cash flow risks, and provide 2 action items for the collections team. Keep it under 250 words.`;
        break;
      default:
        throw new Error(`Unsupported dashboard type: ${type}`);
    }

    const { data: dashboardData, error: rpcError } = await supabase.rpc(
      rpcName,
      {
        p_start_date,
        p_end_date,
      },
    );

    if (rpcError) throw rpcError;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `Here is the JSON output from our database ${timeContext}:
    ${JSON.stringify(dashboardData)}
    
    Provide your summary.`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: { text: systemInstruction } },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API Error: ${JSON.stringify(geminiData)}`);
    }

    const aiSummaryText = geminiData.candidates[0].content.parts[0].text;

    // 4. Save the AI Summary (Allows null dates now)
    const { error: insertError } = await supabase
      .from("ai_dashboard_summaries")
      .insert({
        dashboard_type: type,
        period_start: p_start_date,
        period_end: p_end_date,
        summary_text: aiSummaryText,
      });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, type, message: "Summary generated!" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
