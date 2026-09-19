# Portal Purpose & Department Value

This document exists to answer what this portal is _for_, who does it benefit, and — department by department — what has it genuinely changed about how people work versus opening SAP B1 or HR2000 directly?

Every other doc in `docs/` is feature- or build-state-oriented (what's built, what tab does what, what column a filter reads). This one is outcome-oriented on purpose. It's also a **starting point, not a replacement** — this repo's documentation is due for a full reread and restructure soon, and this document should feed into that rewrite rather than be treated as another fixed artifact sitting alongside the others. Where it disagrees with an older doc, treat this one as the more current read, and treat the disagreement itself as evidence the older doc needs revisiting (see the HR Reports example below).

**A sourcing note, in the interest of honesty**: most of the concrete claims below trace back to specific code comments, RPC headers, or architecture docs cited inline. A few — most notably the payroll reconciliation "before" story — are real operational knowledge that isn't written down anywhere in this codebase's own docs or comments. Those are marked explicitly, not blended in as if they were code-sourced facts.

## Portal Purpose

The portal's own stated mission, in full, is one paragraph in `CLAUDE.md`: it's the unified portal for all Hyrax Oil employees, aiming at real-time dashboards for every department and for executives, fed by a companion project (the Hyrax Data Platform) that extracts data from SAP B1 and IoT devices into this app's Supabase backend. Nothing stronger than that exists today — `README.md`'s "Features"/"Tech Stack" sections describe an architecture this app doesn't have (JWT auth, an Express backend) and should eventually be rewritten to point here instead. That correction is out of scope for this document.

Expanded into the three lenses that actually matter day to day:

**Productivity.** Collapsing facts that used to require mentally combining several separate signals into one glance (a stage badge instead of reading status + balance + a mismatch flag separately), and collapsing multi-step manual work into one click (a payroll reconciliation export, a lifecycle checklist item that completes itself because someone did their normal job elsewhere).

**Collaboration & visibility.** Giving people outside a system's usual audience a real, correct window into it — a Business Partner page so Finance isn't stranded when a customer-related link tries to send them into Sales' own module; a shared onboarding/offboarding case so HR, IT, and the new hire are looking at the same record instead of three disconnected pictures; Workspace giving every department a shared place to track projects/tasks regardless of department gating.

**Decision-making with trusted data.** Turning raw transaction rows into a pre-computed, threshold-aware signal a manager can act on without building their own export — an exception list of reps behind quota instead of a flat table of every rep; an aging bucket instead of a due-date column someone has to eyeball.

**What this portal explicitly is not**: not a new ERP, not a payroll engine (HR2000/an external payroll system stays the system of record for actually paying people), not a wholesale replacement for SAP B1's own modules where SAP already does the job well. The portal's real job is narrower and more specific than "replace the old systems" — it mirrors what SAP/HR2000 already do well, fills in the processes those systems were never built to model at all, and bridges the identity gaps between them.

**The three-part design framework.** Every genuinely valuable build in this portal follows the same shape, independently, across every department that's been looked at closely:

1. **Mirror the system of record faithfully.** Don't re-model what SAP B1/HR2000 already own. Leave Management is read-only because HR2000 is the real system of record for leave — the portal gives HR a clean window onto it, not a second, competing source of truth.
2. **Build a workflow layer only where the system of record has a genuine gap.** Sales' CRM exists because SAP has no leads/quotation concept at all — a deal has zero ERP representation until it's already nearly won. HR's onboarding/offboarding lifecycle case exists because HR2000 has no case concept either — before it, offboarding "didn't exist," just a status field flipping "usually well after the fact."
3. **Bridge identity mismatches, never duplicate business logic.** Sales Rep Mapping bridges SAP's `sales_rep_code` to a real employee (SAP's own `EmpID` field can't do this — it references an internal SAP HR module Hyrax doesn't run). Finance's Business Partners page bridges the same underlying `sap_customers` table that Sales' own Clients page uses, scoped differently for Finance's AR+AP need instead of Sales' pipeline need — never two competing sources of truth for the same customer.

## Is This Delivering Real Value?

Worth answering directly, in the document itself, rather than leaving the answer only in a conversation. **Yes — but unevenly, and none of it is measured.**

The real wins are specific and well-reasoned, not vanity features: Sales' CRM fills a gap SAP genuinely never had (a deal has zero ERP representation until it's already nearly won). Sales Rep Mapping didn't just theoretically prevent a problem — it caused one, got caught, and got fixed (a manager filtering by an unmapped rep once saw the whole company's unfiltered data). HR's lifecycle system closed a real risk that its own architecture doc says plainly "doesn't exist" beforehand — nothing revoked access or reclaimed equipment when someone left. The IT-asset-to-lifecycle sync is a genuinely elegant piece of automation: an IT staffer doing their completely ordinary job silently completes someone else's checklist item, with no extra step for anyone.

The caveats are just as real, and stating them plainly is the point of this section:

- **Two of five built departments have zero proactive notifications.** Finance and Operations are both still pure "watch and remember" — the single biggest differentiator a portal is supposed to have over opening SAP directly (getting told, instead of remembering to check) simply isn't delivered for 40% of what's built.
- **One live dashboard admits its own data may not be trustworthy.** Operations Reports carries a code-level warning that its delivery data may be stale (spanning only 2018–2020 plus a small 2022 set) and "unused by logistics department." That's not an incompleteness problem, it's a trust problem, in exactly the place trust matters most.
- **Nothing is measured.** No doc anywhere in this repo quantifies time saved, errors prevented, or money saved, before or after. The case for value here rests on sound design reasoning and a couple of confirmed, fixed bugs — not on tracked ROI. That's a normal state for a platform at this stage, but it shouldn't be overstated as more than it is.
- **Coverage is narrow relative to the stated mission.** Real, working builds exist for roughly 5 of the ~17 departments in this app's own `departments` table. Two more (Procurement, Warehouse & Logistics — see below) have real groundwork already laid and could become real without much uncertainty. Two more (Production, Quality Assurance) are gated behind a single unresolved question about whether the underlying SAP data even exists in usable form. The rest are genuinely untouched. Against a stated mission of "real-time dashboards for every department," today's actual reach is a minority of the company.

None of this means the work so far wasn't worth doing — the specific things that were built solve specific, real problems. It means the honest read is "a strong, well-reasoned start," not "mission accomplished."

## Sales

**Who it serves.** Individual reps (day-to-day pipeline work), Sales managers (coaching, forecasting, exception review), and — for the fulfillment/collections side — anyone with Finance or MGM access who needs to see an order's downstream status.

**What it replaced / the gap it fills.** Before the CRM, a deal had no representation anywhere until it was essentially already a done transaction — SAP only creates a customer/order record once a sale is imminent, so there was no way to track discovery, sampling, quoting, or negotiation at all. The CRM is described in the codebase itself as "the permanent system of record for that process," not a stand-in for something SAP will eventually do instead.

**Current, concrete value.**

- A lead moves through a real stage graph (Discovery → Sample/Test → Proposal → Negotiation → Won/Lost, plus On Hold/Cancelled from anywhere non-terminal), with the sensitive fields (quotation document, actual revenue, PO number) locked behind guarded stage-transition actions rather than sitting in a casually-editable form — so a rep can't quietly overwrite a PO number after the fact.
- The moment a lead is marked Won with a PO number, the portal starts watching for that PO number to show up on a real SAP sales order, flags the lead "Pending SAP Order" in the meantime, and automatically notifies the lead's owner the moment the match lands — replacing what would otherwise be a manual "did SAP catch up yet" check someone has to remember to make.
- Sales Reports reorganizes around the actual order-to-cash sequence (Pipeline → Order → Invoice → Payment) instead of a "SAP block" and a "CRM block" bolted together, and gives managers a "Needs Attention" exception panel (reps behind budget, sitting on unbilled backlog, or collecting below pace) instead of a flat table of every rep — the two forecasts (self-reported pipeline vs. SAP-recognized invoiced revenue) are deliberately kept side by side, never blended into one misleading number.
- Sales Rep Mapping bridges SAP's numeric sales-rep code to a real employee so every SAP-sourced figure can actually show a name, an avatar, and be filtered by person — this isn't cosmetic: an unmapped rep once caused a real bug where a manager filtering by that rep saw the whole company's unfiltered data (fixed 2026-08, now fails closed instead of open).
- Sales Orders is a genuine Fulfillment Tracker: one page shows delivery status, matched invoices, and payment status together, so a rep or manager can answer "did this order actually get delivered and paid" without opening SAP at all.

**Notification/automation maturity.** Mixed, and honestly one of the stronger showings in the portal: `lead.stage_changed` (Negotiation/Won) and `sales_order.po_matched` are both live today. A handful of small, already-designed extensions (`lead.stage_changed` for Lost, `sales_target.attainment_low`, `sales_rep_mapping.unmapped`) are proposed but not yet built.

**What "complete" would need.** The one real remaining manual step — after a lead is Won with a PO number, a sales admin still has to manually go into SAP B1 and create the actual sales order — is named honestly here as a gap, not glossed over. But automating a _write_ into SAP itself is a materially different, higher-risk class of work than anything built in this portal so far (which is read-only against SAP everywhere else); it shouldn't be treated as a casual next step just because the read-side automation was straightforward. The lower-risk, already-scoped next steps are: the remaining proposed notifications above, and wiring the currently-dormant `sales_orders` bridge table so a Won lead's manually-typed revenue figure can be cross-checked against the real SAP number instead of trusted at face value.

**What business value is still missing.** Beyond finishing what's already started, whole categories of Sales' real work have no representation at all today:
- _True blind spots — never touched_: pricing/contract approval workflows (no discount, price-list, or margin-approval concept anywhere); customer service/complaints handling (no ticket, no case, nothing exists); contract renewal tracking for customers (the only "renewal" concept anywhere in this app is for HR employee contracts).
- _Displayed, but not a real workflow_: a customer's credit limit shows as a read-only field (Clients/Business Partners sidebars), but nothing enforces a credit hold or gates an order against it — it's a number to glance at, not a control.

## Finance

**Who it serves.** Finance staff and managers running day-to-day AR/AP, plus MGM's company-wide read access.

**What it replaced / the gap it fills.** As recently as mid-2026, Finance was, in its own codebase's words, "mostly an AR subledger with a 'Finance' label on it" — a single Gross Profit figure read straight off SAP's own per-invoice field, no real AP mirror, no GL-derived statements. It's since grown into a genuine mirror of SAP's own financial-statement modules (Balance Sheet, Income Statement, Cash Flow) that Hyrax has simply never turned on inside SAP B1 itself.

**Current, concrete value.**

- A single stage badge per invoice/bill (Paid / Overdue / Due Soon / Open / Paid (Verify)) collapses what used to be several separate facts — status, outstanding balance, a paid-vs-applied mismatch flag, due date — into one glance, the same triage speedup the KPI strip already gave at the aggregate level, now pushed down to every row.
- Invoices+Payments and Bills+Vendor Payments are each one tabbed page instead of four separate nav items — checking which payments settled which invoice is the same click, not a page change.
- The Business Partners page (built this session) closes a real dead end: a payment applied "On Account" rather than to a specific invoice used to be a non-clickable label with nowhere to go; it now links to a real Business Partner record. It also fixed an actual bug — a Finance-only user clicking a customer name on an Invoice card used to be sent into Sales' own gated module and hit a wall; that link now always resolves to Finance's own page when rendered on a Finance page, regardless of who's viewing.
- Journal Entries and Chart of Accounts stopped being dead ends — a GL line's business-partner code now resolves to a real name and the correct link (a business partner, or a GL account when the code turns out to be one instead), and Chart of Accounts renders as a real parent-child hierarchy with rolled-up balances instead of a flat list, with balances displaying the correct sign for Liabilities/Equity/Revenue. Journal Entries also gained two exception flags (added 2026-09) — an "Unbalanced" data-sync-completeness signal and a "Posts to a Non-Postable Account" data-integrity signal — plus real Business Partner/Account Code/Entry Type filters, closing what used to be an empty filter config. Whether Finance staff actually use these new flags day-to-day hasn't been validated with real users yet — same operational-knowledge caveat as this document's own HR payroll-reconciliation passage below: this closes a documented capability gap, not a confirmed daily pain point.
- Clicking any GL account in Chart of Accounts — an individual account or a whole category — now gives a real, correct answer instead of a dead end (added 2026-09, a follow-on to the above). This replaced a genuine, confirmed data-accuracy bug, not just a missing feature: clicking a postable account used to jump into Journal Entries filtered by that account's code, but that filter matched whole multi-account journal _entries_ containing any line for the account, then displayed the entry's own total — silently bundling in every other account sharing that entry. Confirmed live: filtering "Salaries, bonus & allowance" for one fiscal year showed a Total Debit/Credit of 1,956,551, a figure only possible by summing whole balanced entries, against the correct per-account figure of 567,669 already shown correctly on Financial Reports. A postable account's own new **Account Ledger** page now shows exactly its own transaction lines and its own monthly/annual movement; a category (title/summary) account's own new **Category Detail** page shows the same movement rolled up across its child accounts, plus the children themselves, one level at a time — the first time these rows have done anything useful when clicked at all. Financial Reports' Operating Expense Breakdown chart links its bars into the same destination, so a manager looking at "what's driving this expense category" can click straight through to the real activity behind it. (Journal Entries' own list-level Total tile still carries the analogous bug when filtered by account/business partner — deliberately not yet fixed, tracked separately as a known, open item.)

**Notification/automation maturity.** The single most concrete gap of any real department: **zero** implemented notifications today. Everything in Finance is still "watch and remember," not "get told" — despite 11 Finance notification rules already being fully designed (`invoice.overdue`, `payment.unallocated_aging`, `bill.overdue`, and others) and simply not built yet.

**What "complete" would need.** Building any of those 11 already-designed notifications would be Finance's highest-leverage next step, by a wide margin — it's the one place where the _design_ work is already done and only the implementation is missing. Beyond that: a per-Business-Partner aggregate "total outstanding" figure (no such aggregate view exists server-side yet, only per-document ones), and a GL line linking back to its originating source invoice/bill, contingent on confirming a base-document column actually exists on the underlying table (deliberately not promised without that check).

**What business value is still missing.** Several whole categories of Finance's own real work have no representation at all today — most of them likely bigger, in real terms, than anything left on the AR/AP roadmap above:
- _True blind spots — never touched_: a company-wide budgeting/forecasting cycle (the only "budget" concept anywhere in this app is Sales' own per-rep `sales_budgets`, a different thing entirely); a real fixed-asset register with depreciation schedules (today "Depreciation & Amortization" is only a GL name-pattern match rolled into the financial statements, not a per-asset record with acquisition/disposal tracking); a treasury/cash-management function (bank movement data is extracted solely to feed the existing Cash Flow Statement, nothing more); tax compliance/filing (tax appears only as one number inside the EBITDA formula); departmental/cost-center P&L allocation (there's no department dimension on any SAP-sourced table at all — which is also the specific, confirmed reason a company-wide P&L can't yet be sliced by department, referenced in this repo's own Executive Summary planning).
- _Displayed, but not a real workflow (partially narrowed 2026-09)_: Journal Entries is framed as an "audit trail," and still is one — it remains a read-only GL mirror, structurally unable to become an operational queue the way Invoices did. Two real exception flags (unbalanced entries, postings to non-postable accounts) now sit on top of it, but a genuine compliance-reporting layer — regulatory reports, control attestations — still doesn't exist, so this gap is narrowed, not closed.
- _Deliberate non-goal, not an oversight_: cash-flow forecasting was explicitly ruled out — SAP B1 already owns it natively, and duplicating it would violate this portal's own "mirror, don't re-model" principle.

## HR

**Who it serves.** HR staff, every employee (self-service visibility into their own onboarding/offboarding/attendance), IT (shares the same lifecycle case, not a separate one), and managers (approvals, org visibility).

**What it replaced / the gap it fills.** Before the lifecycle system, onboarding had scattered point-in-time notifications but, in the architecture doc's own words, "nobody — not HR, not IT, not the new hire themself — has anywhere to look and see the whole picture of where one specific person's onboarding actually stands right now." Offboarding was worse: it "doesn't exist" at all — no signal revoked access, returned equipment, or closed out obligations when someone left, just a status field that eventually flipped, "usually well after the fact." HR2000 itself has no concept of a lifecycle case to begin with, which is exactly the kind of gap this portal is meant to fill rather than something HR2000 was ever going to grow into.

Separately — and this is the operational-knowledge caveat from the top of this document, not something written in this codebase — payroll reconciliation used to mean HR manually compiling and cross-checking attendance and leave data by hand, by your own account spanning about a week of paper/Excel/email work before every payroll cycle.

**Current, concrete value.**

- One shared lifecycle case per onboarding/offboarding event, not three competing checklists — HR's view, IT's view, and the employee's own view are each a filtered slice of the _same_ case. Several items complete themselves: an IT staffer doing their completely ordinary job (assigning a laptop to a new hire in IT Assets) automatically marks that hire's "IT asset assigned" onboarding item done, with zero extra clicks and no separate "update the checklist" step.
- Payroll reconciliation is now a one-click "Payroll Period Summary" export (one row per active employee — hours, overtime, absences, leave days, and every reconciliation flag), with a per-employee drill-in that shows the exact flagged dates in plain English and a single "Send Email" button that queues a consolidated email to that employee. A separate weekly automated job independently notifies every affected employee in-app and gives HR one weekly digest of who still needs outreach — without anyone having to remember to run a check.
- Leave Management is deliberately read-only: HR2000's weekly sync is the real system of record for leave, so the portal gives HR a clean, filterable, CSV-importable window onto it instead of building a second source of truth that would just get overwritten on the next sync anyway.
- HR Reports is fully built and live today — worth stating plainly, because this repo's own other docs currently disagree with each other and with reality about this exact fact (one says it's "on hold," another says it's "broken, unbuilt"). It isn't either — it's shipped. That contradiction is itself the clearest evidence in this whole document that the coming doc-rewrite pass is overdue.

**Notification/automation maturity.** HR and the shared Lifecycle system are two of the most fully-covered notification surfaces in the entire portal — nearly everything real here already proactively tells someone, rather than waiting to be checked.

**What "complete" would need.** The automated _weekly reconciliation email_ (as distinct from the in-app notification, which is already live) is built end-to-end but deliberately switched off — judged "too risky to enable" while the app isn't yet used company-wide. Turning it on when that confidence exists is a flag flip, not new engineering. A finer-grained IT-asset-request table (matching the _right type_ of asset to a role, not just "some asset got assigned") is already designed and saved, just not executed. Departments/Recruitment/Performance remain real, empty stubs — legitimate future modules, but per this portal's own established discipline, worth building once there's a specific need driving them, not simply because a nav entry already exists.

**What business value is still missing.** Beyond the empty Departments/Recruitment/Performance stubs already named above:
- _Named as a known gap, worse than a stub_: Training & Development has no route mounted at all — not even a placeholder page, just a commented-out nav link. It's a step behind Recruitment/Performance, which at least render something.
- _True blind spots — never touched_: disciplinary case management (the only trace anywhere is a status lookup value, "Suspended... due to disciplinary action" — a label, not a case or a workflow); exit interviews have zero real content behind them — the checklist item is a plain HR-toggled checkbox with no form, no notes field, no stored responses, exactly the bare label it appears to be.
- _Deliberate non-goal, not an oversight_: compensation/benefits planning is explicitly out of scope by decision — that data belongs to whatever system actually disburses payroll, not to this portal.

## IT

**Who it serves.** IT staff (asset tracking, onboarding/offboarding execution), and — through the shared lifecycle system — HR and every new/departing employee.

**What it replaced / the gap it fills.** IT Assets itself doesn't have a documented "before" story of replacing a prior spreadsheet process — by the time it's mentioned in this repo's own roadmap, it's already described as "sufficient for a single-user function." Its real value shows up at the seam with HR's lifecycle system: before that connection existed, there was no signal telling IT a new hire even needed a device — "still needs assignment" wasn't tracked anywhere as an actual flag.

**Current, concrete value.**

- Full asset lifecycle tracking (category/subcategory, status, condition, department, assignment) with an Overview page surfacing unassigned assets and — since the lifecycle integration — "Employees Awaiting IT Setup."
- The IT-asset ↔ lifecycle sync runs in both directions automatically: assigning an asset to someone marks their onboarding item done; clearing or reassigning an asset re-checks whether the _previous_ holder's offboarding "assets returned" item should now complete. Neither direction requires a second, manual checklist update.

**Notification/automation maturity.** Nearly fully covered — every real IT-side lifecycle notification (setup needed, revocation needed, last-day approaching) is live. The one exception (`employee.it_asset_requested`) is blocked purely on a database column that doesn't exist yet, not on any design gap.

**What "complete" would need.** Software Management is a genuine, bare stub today — a page that renders literally nothing beyond its own name, with no backing schema at all. This is the clearest, most concrete "complete" gap for IT: it's not just an empty module, it's also the stated reason IT's own Tier-3 Reports page has been deliberately deferred (there's nothing yet to synthesize a report against). Building a real Software Management data model is the single highest-leverage next step for IT, ahead of any reporting layer.

**What business value is still missing.** IT's blind spots skew toward risk/governance functions rather than day-to-day tooling:
- _True blind spots — never touched_: change management (no change-request or approval concept anywhere); a periodic security/access review process (access _revocation_ exists, but only reactively, as one offboarding checklist item — nothing proactively re-certifies who still has access to what); backup/disaster-recovery status tracking; IT budget/spend tracking.
- _Deliberate non-goal, not an oversight_: a helpdesk/ticketing system was explicitly not built — the Help page's own content states the goal is "setting expectations, not ticketing bureaucracy." Vendor/license management is a named future gap, but its own roadmap note honestly questions whether it's even worth building bespoke, given existing tools (e.g. ManageEngine) may already cover it — worth resolving that question before building anything, not after.

## Operations

**Who it serves.** Operations staff and managers, and, through the underlying figures, anyone in Finance/MGM tracking fulfillment.

**A caveat that has to come before anything else about this department**: Operations Reports carries its own code-level warning that the delivery data it's built on may not reflect real current use — a comment in the page itself states the report "is inaccurate as delivery data is unused by logistics department," with the underlying data spanning only 2018–2020 plus a small 2022 set. Any claim about Operations' current value has to sit behind that caveat, not in front of it.

**What it replaced / the gap it fills.** Operations Reports is buildable entirely from SAP data already extracted for other purposes — no new extraction was needed to compute backlog, fill rate, on-time delivery, and cycle time. Whether it reflects a real day-to-day process today is exactly the open question the caveat above raises.

**Current, concrete value (with the caveat above still standing).** Backlog and open-order value, undelivered units, fill rate, on-time-vs-requested and on-time-vs-promised percentages, average order-to-ship/ship-to-invoice/order-to-invoice cycle times, backlog aging, shipment volume trend, and stock position (on-hand vs. committed, most over-committed items first).

**Notification/automation maturity.** Zero implemented, same as Finance — Operations is the other department still entirely in "watch and remember" mode. Three notifications (`item.over_committed`, `delivery.missed_promise_date`, `item.undelivered_backlog_high`) are already designed and proposed, not built.

**What "complete" would need, in order.** First, and ahead of anything else: resolve whether the underlying delivery data is actually current and trustworthy before building anything further on top of it or making real decisions from it today — a nicer dashboard on top of admittedly stale data isn't progress. Second, once that's resolved: the three already-designed notifications above. Third, only after both of those: a dedicated Operations-owned fulfillment/delivery view (the same underlying tables the Sales Orders fulfillment view reads, but through Operations' own lens — delivery/backlog, not invoice/payment status) — a real, well-justified candidate identified separately this session, but one that should follow the data-quality fix, not precede it.

**What business value is still missing.** Beyond the data-quality question above, whole categories of what a real operations function does are simply invisible today:
- _True blind spots — never touched_: maintenance/equipment uptime tracking; safety/incident management (the only "safety" content anywhere in this app is fictional demo copy on the general Announcements feed, not a real incident system); quality holds tied to production output (this is QA's own unbuilt territory — see below — so Operations has nothing to gate against yet either).
- _Named as a known gap, with real downstream consequences_: shift/labor scheduling doesn't exist as a table anywhere in this system — which is also, concretely, why the Attendance dashboard's "Late Arrivals" KPI has to assume a fixed 09:00 company-wide time instead of checking against each employee's actual scheduled shift. This gap isn't Operations-exclusive, but it directly limits what Operations (and HR) can honestly report.

## The Four Dormant Departments — Not Equally Dormant

Quality Assurance, Procurement, Warehouse & Logistics, and Production have no real build today — no pages, no routes, no extracted SAP tables. But treating them as one undifferentiated "nothing here" would be inaccurate: research into this repo's own prior architecture planning found they sit at four genuinely different readiness tiers, from "half-built already, blocked purely on data" to "too little exists yet to responsibly say anything beyond a dependency." They're presented here in physical-goods-flow order — buy the raw materials, make the product, check it, store and ship it.

### Procurement

**Who it would serve.** A Procurement staff member/manager, plus AP/Finance, who already own half of this today.

**Current state — closer to real than the other three.** The AP-aging/DPO half of procurement ("what do we owe, and when") is already live, on Finance Reports — it just isn't badged as "Procurement." What's genuinely missing is the purchasing-commitment half ("what have we committed to buy, is it arriving on time"), which needs the Purchase Order and Goods Receipt chain (SAP's `OPOR`/`POR1`, `OPDN`/`PDN1`) — none of that is extracted from SAP at all today. This app's own AP invoice mirror is explicitly "standalone" as a result — it has no "where did this originate" trail the way an AR invoice already has back to a sales order.

**What "real" would need.** This repo's own planning already contains an explicit warning worth repeating: don't ship a supplier-master-only stub page. The right sequencing is to define the full RPC contract now — reusing Finance's already-built AP-aging/DPO calculations directly rather than re-deriving them — and build the actual page once the PO/Goods-Receipt data lands. Once it does, this is also what would finally let a vendor bill be matched back to what was actually ordered and received, closer to a real three-way check, rather than the AP mirror standing alone.

### Production

**Who it would serve.** A Production/Plant Manager, daily.

**Current state — genuinely unresolved, not just unbuilt.** This is stronger than "not built yet": it's stated plainly elsewhere in this repo's own planning that it's "genuinely unconfirmed whether Hyrax's live SAP instance even has real, populated production-order data at all." Any interim content that could ship today would be demand-/inventory-side proxies (committed demand from open order lines, a replenishment candidate list, shipped volume standing in for throughput) — and would have to stay clearly labeled as a proxy, not real output, if it's ever built.

**What "real" would need.** A live discovery spike against Hyrax's actual SAP data, first, before any extraction or UI work — this repo's own docs compare the risk here directly to SAP's Cash Flow Categories module, which turned out to technically exist but be essentially unused (six placeholder rows). This could genuinely be a dead end. Building anything beyond the labeled proxy panel before that spike resolves would be guessing, not planning.

### Quality Assurance

**Who it would serve.** QA staff, and — indirectly — Production and Operations, since a QA release is what would let a batch become sellable finished-goods stock.

**Current state — the thinnest in this entire document.** Almost nothing exists beyond two labels in this repo's own target-architecture sketch ("Batch Output," "QA Batch Test/Release") and one confirming line that its would-be table was "only ever a hypothetical name in a design doc's proposed star schema, never a real table." There isn't enough here to responsibly describe a target state beyond its position in the flow.

**What "real" would need.** QA sits entirely downstream of Production's own unresolved question above — there's no batch to test or release if Production's order/BOM data doesn't reliably exist in SAP in the first place. Nothing should be scoped for QA specifically until that question is answered.

### Warehouse & Logistics

**Who it would serve.** Warehouse/logistics staff, plus everyone already reading Operations Reports today.

**Current state — partially already real, just filed under a different name.** Today's Operations Reports page explicitly _is_ the real module that replaces what an older internal doc fictionally called "Warehouse & Logistics" — backlog, fill rate, on-time delivery, and stock position are already live, computed entirely from already-extracted SAP data. What's still genuinely missing is bin/transfer/movement-level granularity (SAP's bin-and-batch-location tables, stock transfers, inventory movements) — none of that is extracted at all.

**What "real" would need.** One near-zero-effort win is sitting right there today: per-warehouse stock data (`sap_item_warehouse_stock`) was already extracted back in 2026-08, but was never wired into Operations' own stock-position calculation, which is still company-wide only. Wiring that in is the cheapest, most concrete improvement available anywhere in this section — it needs no new SAP extraction at all, just connecting data that already exists. Bin/transfer/movement detail beyond that would need genuinely new extraction work.

**A cross-cutting note: Returns & Credit Memos.** SAP's Returns/Credit-Memo documents (`ORIN`/`RIN1`) aren't extracted either, and don't belong to any one department above — they're what's currently blocking a return-rate KPI on the Sales side and a net-of-returns revenue figure on the Finance side. Worth tracking as one small, well-scoped extraction rather than a department of its own.

## Cross-Department Modules

**Workspace** (Projects/Tasks/Documents) sits outside the department-gating model entirely — it's open to every authenticated user regardless of department — and is, by a wide margin, the most notification-complete module in the whole portal: assignment, status changes, due dates, overdue items, membership changes, and document attachment/removal are all already live. It's the most direct, literal expression of the "collaboration" pillar this document opened with.

**The remaining dormant departments** — Marketing, Business Development, Corporate Strategy, GEC's Office, Corporate Communications, Administration, and the non-operating General/Suspended codes — have no real nav entries, no routes, no RLS policies, and (as far as this portal's own data shows) no real assigned users today, and — unlike Procurement/Production/QA/Warehouse & Logistics above — no prior architecture planning exists for them anywhere in this repo either. No current-state or target-state content is written for them here; inventing either would be pure speculation with nothing to ground it. They're named so their absence reads as a deliberate, confirmed fact rather than an oversight.
