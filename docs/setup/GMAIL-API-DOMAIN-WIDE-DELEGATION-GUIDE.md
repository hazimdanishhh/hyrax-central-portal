# Gmail API via Google Workspace Domain-Wide Delegation — Setup Guide

Step-by-step for wiring up **Option B** from [`docs/NOTIFICATIONS-ARCHITECTURE.md`](../NOTIFICATIONS-ARCHITECTURE.md): sending real email from `send-queued-emails.ts` through the Gmail API, authenticated as a service account impersonating a real Workspace mailbox (e.g. `notifications@hyraxoil.com`). This is self-serve end to end since you're the Workspace admin — nobody else needs to grant anything.

**What you're building, in one sentence:** a GCP service account gets a private key (yours to keep secret), your Workspace grants that specific service account permission to send mail _as_ one specific mailbox, and `send-queued-emails.ts` uses the key to prove its identity and get a short-lived token to send through the Gmail API.

**Cost:** $0. This uses your existing Google Workspace subscription and the free tier of Google Cloud (a service account + API calls at this volume cost nothing).

---

## Before you start: decide the sender mailbox

Pick the real Workspace mailbox mail will be sent _as_ — e.g. `notifications@hyraxoil.com`. It must actually exist:

- Reuse an existing mailbox, or
- Create a new one first: Workspace Admin Console → Directory → Users → **Add new user** (a full licensed user), or **Groups** if you'd rather it be a group alias that forwards somewhere real — a full user is simpler and is what this guide assumes.

Write this address down — you'll need it twice (Workspace delegation step, and the `GMAIL_SENDER_EMAIL` secret).

---

## Part 1 — Google Cloud Console (console.cloud.google.com)

### 1.1 Choose a project

`hyrax-data-platform` already has a GCP project (used for BigQuery, per its `gcp-sa-key.json`). Two options:

- **Reuse that project** — simplest, one less thing to manage.
- **Create a new, dedicated project** (e.g. `hyrax-notifications`) — cleaner separation between "data pipeline" and "app-sending-email" concerns, if you'd rather keep IAM/audit boundaries distinct.

Either works identically for the steps below. To create a new one: top-left project dropdown → **New Project** → name it → Create.

### 1.2 Enable the Gmail API

1. Left sidebar (or search bar) → **APIs & Services** → **Library**.
2. Search for **Gmail API**.
3. Click it → **Enable**.

### 1.3 Create a service account

1. **APIs & Services** → **Credentials**, or **IAM & Admin** → **Service Accounts**.
2. **Create Service Account**.
3. Name it something clear, e.g. `hyrax-notification-sender`. The email will auto-generate as something like `hyrax-notification-sender@<project-id>.iam.gserviceaccount.com`.
4. Click through the optional "grant this service account access to project" and "grant users access" steps — **skip both**, no GCP IAM roles are needed for this. The permission that matters comes entirely from Workspace domain-wide delegation in Part 2, not from GCP IAM.
5. **Done**.

### 1.4 Generate a JSON key

1. Click into the service account you just created.
2. **Keys** tab → **Add Key** → **Create new key**.
3. Choose **JSON** → **Create**.
4. A `.json` file downloads automatically. **Treat this like a password** — anyone with this file can send mail as whichever mailbox you delegate to it (see the security note at the end). Don't commit it to a repo, don't share it over chat/email.

You'll paste this file's _entire contents_ into the `GMAIL_SERVICE_ACCOUNT_JSON` Supabase secret later.

### 1.5 Find the service account's numeric Client ID

This is the one easy-to-miss step: Workspace delegation needs the service account's **numeric Client ID**, not its email address.

1. Still on the service account's details page, look for **Unique ID** (a long number, e.g. `123456789012345678901`).
2. Copy it — you'll paste it into Workspace Admin Console next.

(If you can't find it there: **IAM & Admin** → **Service Accounts** → the list view has a "Unique ID" column.)

---

## Part 2 — Google Workspace Admin Console (admin.google.com)

### 2.1 Open Domain-Wide Delegation

1. **Security** → **Access and data control** → **API Controls**.
2. Under "Domain-wide delegation", click **Manage Domain Wide Delegation**.
3. **Add new**.

### 2.2 Authorize the service account

1. **Client ID**: paste the numeric Unique ID from step 1.5.
2. **OAuth Scopes**: paste exactly:
   ```
   https://www.googleapis.com/auth/gmail.send
   ```
   (Only this one scope — don't add more than the sender actually needs. `gmail.send` allows sending mail but not reading/deleting anything.)
3. **Authorize**.

That's it on the Workspace side. Google's own documentation notes this can take a few minutes to propagate, occasionally longer (rarely up to 24 hours) — if your first test fails with an authorization error, wait and retry before assuming something's misconfigured.

---

## Part 3 — Wire it into Supabase

Dashboard → **Edge Functions** → `send-queued-emails` → **Secrets**:

| Secret                       | Value                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `EMAIL_PROVIDER`             | `gmail`                                                                      |
| `GMAIL_SERVICE_ACCOUNT_JSON` | the **entire contents** of the JSON file from step 1.4, pasted as one string |
| `GMAIL_SENDER_EMAIL`         | the mailbox you decided on up top, e.g. `notifications@hyraxoil.com`         |

(If you haven't deployed `send-queued-emails.ts` yet at all, do that first — see [`NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./NOTIFICATIONS-DEPLOYMENT-GUIDE.md) step 6.)

---

## Testing it

Cheapest way to test without waiting for a real lead stage change: manually queue one row and let the next cron tick pick it up.

```sql
insert into public.email_queue (to_email, subject, body_html)
values ('your.own.address@hyraxoil.com', 'Gmail API test', '<p>If you got this, it worked.</p>');
```

Wait up to 5 minutes (the cron interval), then check:

```sql
select * from public.email_log order by sent_at desc limit 5;
select * from public.email_queue order by created_at desc limit 5;
```

`email_log.status = 'sent'` with `provider = 'gmail'` means it worked. If `email_queue.status` is still `pending` with a `last_error`, or landed in `email_log` as `failed`, see below.

---

## Troubleshooting

| Error                                    | Likely cause                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `unauthorized_client`                    | Domain-wide delegation not set up correctly — wrong Client ID pasted, wrong/extra scope, or it just hasn't propagated yet (wait a few minutes and retry).                                                                                                          |
| `invalid_grant`                          | The `sub` (sender mailbox) isn't a real, active user in your Workspace, or there's significant clock skew between the JWT's `iat`/`exp` and Google's clock (very unlikely in a Deno Edge Function, but check `GMAIL_SENDER_EMAIL` is spelled exactly right first). |
| `403` from the Gmail API itself          | Gmail API not actually enabled on the project the service account belongs to (step 1.2), or the scope authorized in step 2.2 doesn't match `gmail.send` exactly.                                                                                                   |
| `GMAIL_SERVICE_ACCOUNT_JSON` parse error | The secret wasn't pasted as valid JSON — make sure you copied the _entire_ downloaded file, including the outer `{ }`, with no extra escaping added.                                                                                                               |

---

## Security notes

- The service account's private key can send mail **as any mailbox you delegate it to** — right now that's just the one `GMAIL_SENDER_EMAIL`, because that's the only scope+identity combination authorized in step 2.2. If you ever widen delegation later, keep it as narrow as the actual need.
- Rotate the key (Service Accounts → Keys → delete the old one, create a new one, update the Supabase secret) if you ever suspect it's been exposed.
- This is a genuinely powerful credential for a single scope (`gmail.send` only, not full Gmail access) — treat it with the same care as a database password, not as casually as a public API key.
