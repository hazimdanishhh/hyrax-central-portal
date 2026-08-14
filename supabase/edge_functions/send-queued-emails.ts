import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// pg_cron-scheduled every few minutes (set up in the Supabase dashboard,
// same as auto-clock-out.ts's cron -- see docs/NOTIFICATIONS-ARCHITECTURE.md
// for the exact schedule call). Reads pending email_queue rows, sends via
// whichever provider EMAIL_PROVIDER selects, and durably records the
// outcome in email_log -- the thing Discord alerts never had. One row's
// failure never stops the rest of the batch.
const MAX_ATTEMPTS = 3;
const BATCH_LIMIT = 50;

// ─── SENDERS ────────────────────────────────────────────────────────────
// Both fully implemented -- selected by the EMAIL_PROVIDER secret. Neither
// requires code changes to switch; just set the secret and the matching
// provider's own credentials.

async function sendViaResend(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY")!;
  const from =
    Deno.env.get("RESEND_FROM_EMAIL") || "notifications@hyraxoil.com";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    throw new Error(`Resend API error (${res.status}): ${await res.text()}`);
  }
}

function base64url(input: string | Uint8Array): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Gmail API, sending "as" a delegated Workspace mailbox via a service
// account with domain-wide delegation -- see
// docs/NOTIFICATIONS-ARCHITECTURE.md for the one-time Workspace Admin
// Console + GCP setup steps (only your Workspace admin can grant these;
// nothing here can self-serve that part). GMAIL_SERVICE_ACCOUNT_JSON is
// the downloaded service-account key; GMAIL_SENDER_EMAIL is the mailbox
// to impersonate (e.g. notifications@hyraxoil.com).
async function getGmailAccessToken(): Promise<string> {
  const serviceAccount = JSON.parse(
    Deno.env.get("GMAIL_SERVICE_ACCOUNT_JSON")!,
  );
  const senderEmail = Deno.env.get("GMAIL_SENDER_EMAIL")!;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    sub: senderEmail, // impersonate this mailbox -- requires domain-wide delegation
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const pemBody = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );

  const jwt = `${unsigned}.${base64url(new Uint8Array(signature))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Gmail OAuth token error: ${await tokenRes.text()}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

async function sendViaGmail(to: string, subject: string, html: string) {
  const senderEmail = Deno.env.get("GMAIL_SENDER_EMAIL")!;
  const accessToken = await getGmailAccessToken();

  const rawMessage = [
    `From: ${senderEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\r\n");

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64url(rawMessage) }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gmail API error (${res.status}): ${await res.text()}`);
  }
}

// env-gated, same convention as hyrax-data-platform's Discord alerting --
// no provider configured means log instead of send, not error. Returns
// which provider actually handled it, for email_log.
async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<string> {
  const provider = Deno.env.get("EMAIL_PROVIDER");

  if (provider === "resend") {
    await sendViaResend(to, subject, html);
    return "resend";
  }

  if (provider === "gmail") {
    await sendViaGmail(to, subject, html);
    return "gmail";
  }

  console.log(
    `[send-queued-emails] EMAIL_PROVIDER not set -- would send to ${to}: ${subject}`,
  );
  return "none";
}

// ─── DISPATCHER ─────────────────────────────────────────────────────────

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pending, error: fetchError } = await supabase
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
    });
  }

  let sent = 0;
  let failed = 0;

  for (const row of pending || []) {
    try {
      const provider = await sendEmail(
        row.to_email,
        row.subject,
        row.body_html,
      );

      await supabase
        .from("email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);

      await supabase.from("email_log").insert({
        queue_id: row.id,
        to_email: row.to_email,
        subject: row.subject,
        status: "sent",
        provider,
      });

      sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const exhausted = attempts >= MAX_ATTEMPTS;

      await supabase
        .from("email_queue")
        .update({
          attempts,
          last_error: errorMessage,
          status: exhausted ? "failed" : "pending",
        })
        .eq("id", row.id);

      if (exhausted) {
        await supabase.from("email_log").insert({
          queue_id: row.id,
          to_email: row.to_email,
          subject: row.subject,
          status: "failed",
          error: errorMessage,
        });
      }

      failed++;
    }
  }

  return new Response(
    JSON.stringify({ sent, failed, total: (pending || []).length }),
    { status: 200 },
  );
});
