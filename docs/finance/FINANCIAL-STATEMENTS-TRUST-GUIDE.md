# Financial Statements Trust Guide

Written for you as the data owner, not as a developer reference — `RPC-REFERENCE.md`/`hyrax-data-platform`'s `data-dictionary.md` are the formula-level references; this is "what do these numbers actually mean, and how much should I trust them."

**Last independently verified: 2026-09** — see [`GL-ACCOUNTS-AUDIT-2026-09.md`](./GL-ACCOUNTS-AUDIT-2026-09.md) for the full row-by-row check this guide's confidence is based on. If that audit is ever redone, update this line.

## The ratios, in plain terms

All three come from `sap_gl_accounts.current_balance_myr`, summed per category via a real parent-child walk (`father_code`), never by reading account-code text — account codes in this chart of accounts are confirmed *not* reliable prefixes for category (multiple real examples found in the audit above).

- **Current Ratio** = Current Assets ÷ Current Liabilities. Answers: "if every current liability came due today, could current assets cover it?" Above 1 is generally healthy; well below 1 is a liquidity concern.
- **Quick Ratio** = (Current Assets − Inventory) ÷ Current Liabilities. Same question, but excludes inventory (the current asset that's slowest to convert to cash) — a stricter test.
- **Working Capital** = Current Assets − Current Liabilities. The absolute RM buffer, not a ratio.

The audit confirmed every category feeding these (Current Assets = drawer 1 / category `200`; Current Liabilities = drawer 2 / category `300`) is complete — no account silently missing from either bucket.

## `balanceCheckDelta` — what it is, and why it's never exactly zero

Every balance sheet must satisfy Assets = Liabilities + Equity. `balanceCheckDelta` is `(Current Assets + Fixed Assets) − (Total Liabilities + Total Equity)` — it should land close to zero, and the gap is exposed on purpose rather than rounded away.

**Why it's never exactly zero**: the current fiscal year's profit/loss hasn't been closed into Retained Earnings yet (that only happens at year-end close in SAP). Until then, this year's accumulated net profit sits "unclosed," so the identity is off by roughly that amount.

**What's a normal size for this residual, versus alarming**: as of this guide, the recomputed figure is **-RM3,078,683.85** (see the audit doc — up from ~RM205K when this was last checked, some time earlier in the fiscal year). Rule of thumb: **the residual should track roughly with accumulated profit/loss since the last year-end close, and it should never involve a sudden jump unrelated to normal trading activity.** If you ever see this number swing sharply between two check-ins with no proportionate business reason, that's the signal to investigate — not the absolute size of the number alone, since it naturally grows through the year.

## The Cash Flow Statement's two reconciliation checks

The Cash Flow Statement is computed indirectly (from Balance Sheet movements, not a direct cash ledger), so it's checked against two *independent* sources of "what actually happened to cash":

- **vs. the G/L's own cash balance movement** (`reconciliationDeltaVsGl`) — does the computed cash flow match how much the cash/bank G/L accounts actually moved?
- **vs. real bank account movements** (`reconciliationDeltaVsBank`) — does it match SAP's own bank-movement records (`OBNK`), a completely separate data source from the G/L postings?

**There is no tolerance logic in the SQL itself** — both deltas are raw signed numbers, always returned. The 15%/40%-of-materiality "warning/critical" color bands you see on the Cash Flow page are a **frontend-only** judgment call (`Math.max(|netChangeInCash|, RM50,000) × 15%/40%`), not something the database enforces. A small residual is expected — largely attributable to fiscal-year-end FX revaluation, a standard accounting adjustment (IAS 7), not an error. A large one, or one where the two deltas disagree sharply with each other, is the actual signal something's wrong — not the presence of a residual by itself.

Two real bugs were found and fixed in this exact calculation before (documented in `get_finance_dashboard_rpc.sql`'s own comments): short-term borrowings once misclassified as working capital instead of financing activity, and depreciation once double-counted in investing cash flow. Both are fixed; the audit above didn't find anything of that scale still outstanding.

## How to check this yourself going forward

You don't need to trust this document indefinitely. The repeatable process, if you ever want to re-verify:
1. Export `sap_gl_accounts` (Supabase Studio → Table Editor → Export, or SQL editor `select * from sap_gl_accounts`).
2. Re-run the same checks the 2026-09 audit did: orphaned `father_code`s (should be 0), cycles (should be 0), every postable account's Level-2/Level-3 category against `get_finance_dashboard_rpc.sql`'s hardcoded lists, and the sign of `current_balance_myr` against each drawer's expected normal side (drawers 2/3/4 negative, drawers 1/5/6/7/8 positive, with known exceptions for contra-accounts, "IIS-" accounts, and net gain/loss accounts — see the audit doc for the specific named exceptions already found).
3. Compare today's `balanceCheckDelta` and Cash Flow reconciliation deltas against what's documented here — the direction (growing through the fiscal year, small relative to total assets) matters more than the exact figure.

## What this guide is *not* claiming

This confirms the **calculations are structurally sound and complete** against the real chart of accounts. It does not confirm — and this codebase has no way to confirm — whether Hyrax's Finance/accounting staff actually rely on these specific figures day-to-day, or whether the two small unexplained-sign accounts flagged in the audit have a real business explanation. Those are real-world questions for the people who work with this data, not something verifiable from code or a CSV export alone.
