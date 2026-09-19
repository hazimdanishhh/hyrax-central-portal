# GL Accounts Audit — 2026-09

A full, row-by-row audit of `sap_gl_accounts` against a live export (`sap_gl_accounts_rows.csv`, 553 rows, provided directly rather than queried live — no Supabase service-role access was used or needed for this). Run as a local, read-only script parsing that CSV; nothing here touched a live system. This replaces the sample/example-based verification `get_finance_dashboard_rpc.sql`'s own comments previously relied on (a handful of named accounts, one aggregate identity check) with an exhaustive check of every row.

**Why this exists**: this exact class of gap — verifying a chart-of-accounts classification by sample rather than exhaustively — previously produced a real, material bug (a -RM42.8M Short Term Borrowings category misclassified as trade payables, caught only by a later live reconciliation; see `get_finance_dashboard_rpc.sql`'s own `cf_agg` comment). This audit exists to close that gap properly rather than leave it as a documented risk.

## 1. Hierarchy integrity — perfect, across all 553 rows

- **Orphaned `father_code`s: 0.** Every non-null `father_code` resolves to a real `account_code`.
- **Cycles: 0.** No account's ancestry chain loops back on itself.
- **Level mismatches: 0.** Every child's `level` is exactly its father's `level + 1`, with no exceptions.
- **Drawer containment mismatches: 0.** Every account's own `drawer` matches its Level-1 root's `drawer` — no cross-drawer contamination anywhere in the tree.
- Row counts: 553 total, 426 `is_postable='Y'`, 127 `'N'` — exactly matching `hyrax-data-platform/docs/data-dictionary.md`'s documented figures.

## 2. Category coverage for the Balance Sheet — no real gap

`get_finance_dashboard_rpc.sql`'s itemized Balance Sheet breakdown hardcodes a specific set of Level-2 (`100/200/300/400/500/600/700/800`) and Level-3 (`1000/1100/2000/2100/2200/2300/2400/2500/2600/2700/3000/3100/3200/3300/4000/4100/4200/7200`) category codes. Checked every postable account's real ancestry (via the `father_code` walk, not account-code text) against these lists:

- **Every Level-2 category actually in use exactly matches the hardcoded set.** No gap at all — this is what backs Current Ratio, Quick Ratio, Working Capital, Total Liabilities, Total Equity, and all are safe.
- **197 postable accounts fall outside the hardcoded Level-3 list — but all 197 sit under drawers 4/5/6/7 (Income Statement territory), where the RPC was never meant to have itemized Level-3 lines** — those drawers are correctly summed at the drawer level (`gl_period_revenue`/`gl_period_cogs`/`gl_period_opex`/`gl_period_other_expenditure`) instead, not per-Level-3-category. Zero of the 197 sit under drawers 1/2/3 (the actual Balance Sheet drawers).
- **Correction to a mid-audit suspicion**: `2800` ("Non Current Assets (SL)") and `2900` ("Current Assets (SL)") looked like a possible gap in the itemized Balance Sheet breakdown during manual review. The full check disproves this — both categories have **zero postable accounts** under them (empty Sri-Lanka-shadow placeholder branches), so there is nothing to miss today.

**Conclusion: the Balance Sheet's itemized line-item breakdown has no real gap as of this audit.**

## 3. New confirmed examples of "account code ≠ real category"

`data-dictionary.md` already documents one example (`6200260`, coded like a "620x" account but actually Cost of Sales/drawer 5). This audit found several more, all confirmed via the real `father_code` chain — useful as concrete evidence for why this codebase never infers category from account-code text:

- `7100108` ("Depreciation") and `7100144` ("Stamping & Processing Fees") sit numerically between other `7100xxx` drawer-6 (Expenses) accounts, but are both actually drawer 7 (Other Expenditure), filed under a different branch (`810010`, "Other Operating Expenses").
- `6500` ("Distribution Cost") looks like it belongs with the `6000`-`6400` Cost-of-Sales family (drawer 5), but is drawer 6 (Expenses); `6600` ("Agent Commission") immediately after it flips back to drawer 5 — drawer assignment is not monotonic with account-code ordering even at the Level-3 category level.
- `2300140` ("RHB CMOi") looks like a `2300` (Deposit HO) account but its real father is `250010` — it's filed under `2500` (Fixed Deposits) instead.
- `3200350` and `3200355` (named after specific individuals/entities) look like `3200` (Short Term Borrowings) accounts but their real father is `310010` — they're filed under Other Payables & Accruals instead.

None of these break any current calculation (the RPC always resolves category via the real ancestry walk), but they meaningfully strengthen the existing warning against ever taking a shortcut based on account-code prefixes.

## 4. Sign-convention exceptions — mostly expected, two worth a look

Checked every postable account's sign against its drawer's expected normal side (drawers 2/3/4 expected ≤ 0, drawers 5/6/7/8 expected ≥ 0, drawer 1 excluded from this check since bank-overdraft-type negatives are already a known legitimate exception). 11 raw flags, of which 9 are confirmed expected behavior, not anomalies:

- **6 are the already-documented "Other Income nests inside the Expenses drawer" design** (`data-dictionary.md`'s own note on account `8000`): `8000120`, `8000140`, `8000200`, `8000250`, `8000270`, `8100185` are all Other-Income-type accounts nested under drawer 6 — negative values there are the intended, documented behavior (income nets as a credit against a debit-normal drawer), not a bug.
- **2 are net gain/loss "swing" accounts** that can legitimately go either direction regardless of their drawer's normal side: `5000185` ("Currency Gain Loss", drawer 7) and `8100110` ("(Gain)/Loss on Disposal of FA", drawer 7).
- **1 is a variance account** that can legitimately swing either way: `6400160` ("WIP Variance", drawer 5).
- **Also confirmed systematically** (not just spot-checked): every "IIS-" (Interest-in-Suspense) account under Short Term Borrowings is a deliberate positive contra-liability, always paired with a negative loan-principal sibling of matching magnitude (e.g. `3200305`/`3200306`, `3200345`/`3200346`).

**Two genuinely unexplained, worth flagging to Finance** (small in absolute terms, ~RM234K combined against a multi-million-RM balance sheet, but not accounted for by any pattern found in this audit):
- `3000120` "Trade & Other Creditors - SGD" — positive RM27,630.82 (a Liability, expected negative).
- `3100170` "Provision for Taxation" — positive RM206,319.54 (a Liability, expected negative).

## 5. Balance identity check — recomputed, notably larger than previously documented

`sum(current_balance_myr)` across all postable Assets(1)+Liabilities(2)+Equity(3) accounts, today: **-RM3,078,683.85**. The last documented figure (`get_finance_dashboard_rpc.sql`'s own comment) was ~RM205K. Both are framed as the expected "un-closed current-year P&L" residual — a growing residual as the fiscal year progresses before annual close is the expected direction, but the ~15x growth is worth knowing about explicitly rather than assuming the old figure still holds. Not flagged as an error; flagged as "the number moved, here's the current one."

## 6. Drawer 8/9/10

- **Drawer 8 (Taxation): confirmed completely empty** — exactly one row exists (the root itself), zero children of any kind, not just zero *postable* accounts. Stronger confirmation than the previously-documented "no confirmed activity."
- **Drawers 9 and 10 exist**, as empty placeholder roots (`#9`, `#10`, added 2024-12-22, zero children) — not documented anywhere previously. SAP B1 reserves up to 10 drawers; Hyrax's live chart of accounts only uses 1-8.

## 7. Latent, currently-harmless risk: D&A name-match isn't drawer-restricted

`get_finance_dashboard_rpc.sql`'s Depreciation/Amortization figure (`gl_period_depreciation_amortization`, feeding EBITDA) matches by name (`ilike '%depreciation%' or '%amorti%'`) with **no drawer restriction**. Five accounts match today: `6200260` (drawer 5), `7100108` (drawer 7), `7500260` (drawer 6, zero balance), `8200100` (drawer 7, zero balance) — and **`100120` "ROU Building - Acc Amortisation" (drawer 1 — a Balance Sheet contra-asset account)**, currently at zero balance with no posting activity.

If that drawer-1 account ever receives real postings, its activity would silently flow into the Income Statement's D&A figure (and therefore EBITDA) even though it sits on the Balance Sheet side. Zero impact today since the account is inactive — flagged as a watch item, not a current bug.
