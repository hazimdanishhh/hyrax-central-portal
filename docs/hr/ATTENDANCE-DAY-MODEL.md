# How the Portal Describes a Day of Attendance

For HR. This explains what the portal is telling you on the Attendance and
Payroll Export pages, what each label means, and what you are expected to do
about it.

The single thing worth understanding: **every day is described by four
independent facts, not one status.** Once that clicks, the filters and the
badges stop looking arbitrary.

---

## 1. The four questions

Every employee gets one row per day. The portal answers four separate questions
about that day, and they do not override each other.

| Question | What it covers | Where you see it |
|---|---|---|
| **What kind of day was it?** | An ordinary working day, a weekend, a public holiday, or a weekend that is also a public holiday | "Calendar" filter |
| **What was recorded against it?** | Nothing, half a day of leave, a full day, or a data error | shown on the day's card |
| **How did we find out about it?** | A card scan at the door, the app, both, or nothing at all | "Data Quality" filter |
| **Has it been approved?** | Only applies to app entries — approved, waiting, or rejected | "Approval" filter |

These combine. A day can be **worked**, *and* have only one card scan, *and*
still be waiting for approval — all three at once. The portal used to force
those into a single word and show you whichever one it happened to pick first,
which is why some problems never appeared. Now each shows as its own badge.

---

## 2. Day Type — the label you will use most

This is the headline label on every card and the main filter. Fifteen values,
grouped the way the dropdown groups them.

### Ordinary working days

| Label | What happened | What to do |
|---|---|---|
| **Worked** | Attended a normal working day | Nothing |
| **Absent** | A normal working day, no leave recorded, no attendance at all | **Follow up.** Add the attendance, apply leave, or confirm it unpaid |
| **On Leave** | Full day of approved leave, no attendance | Nothing |
| **On Leave (Partial)** | Part-day leave, and the working part is covered | Nothing |

### Needs your attention

| Label | What happened | What to do |
|---|---|---|
| **Leave/Attendance Conflict** | A full day of leave is recorded, but they also attended | Check with the employee. Either the leave is wrong or it was entered against the wrong date |
| **Insufficient Half-Day Hours** | Half-day leave recorded, but under 4 hours worked on the other half | Usually a small administrative gap. Review and accept, or correct the record |
| **Leave Data Error** | The leave entries for that day add up to more than one whole day | A data-entry mistake in HR2000 — a duplicate, or a half-day and a full day on the same date |

### Weekends

| Label | What happened | What to do |
|---|---|---|
| **Weekend** | An ordinary weekend, nobody worked | Nothing |
| **Weekend (Worked)** | Someone attended on a weekend | **Payroll-relevant.** Rest-day rates apply |
| **Weekend (On Leave)** | Leave was recorded against a weekend | Nothing — an HR2000 artefact, harmless |

### Public holidays

| Label | What happened | What to do |
|---|---|---|
| **Public Holiday** | A holiday, nobody worked | Nothing |
| **Public Holiday (Worked)** | Someone attended on a holiday | **Payroll-relevant.** Holiday rates apply |
| **Public Holiday (On Leave)** | Leave recorded against a holiday | Nothing |
| **Weekend + Public Holiday** | A holiday that fell on a weekend | Nothing |
| **Weekend + Public Holiday (Worked)** | Worked on a holiday that fell on a weekend | **Both** entitlements apply — this is intended, not double-counting |

> **On holidays being per-location.** Public holidays are set per work location.
> A day can be a holiday in KL and an ordinary working day in Meru, and the
> portal treats each employee according to their own location.

---

## 3. Data Quality and Approval — shown alongside, never instead

These appear as extra badges next to the Day Type label. A clean day shows
none of them.

**Data Quality** — is the record complete?

| Badge | Meaning |
|---|---|
| **Incomplete Card Scans** | Only one scan that day. We know they were there, but not how long — the hours for that day will read as zero |
| **Missing App Check-Out** | An app session was started and never closed |
| **Incomplete Scans + Missing Check-Out** | Both |

**Approval** — only for app entries:

| Badge | Meaning |
|---|---|
| **Pending Approval** | Waiting on a manager or HR. **These hours are held back from payroll totals until approved** |
| **Rejected** | The claim was refused. Contributes no hours |

No badge means either approved, or there was no app entry at all.

---

## 4. Reconciliation — what needs finishing before payroll

"Needs Reconciliation" is the filter that answers *what is still outstanding
this cycle*. It covers **five** situations:

| Category | Can it be closed by acknowledging? | Who can close it |
|---|---|---|
| Absent (not yet reviewed) | **Yes** | The employee, their manager, HR, or a superadmin |
| Insufficient Half-Day Hours | **Yes** | HR or superadmin only |
| Leave/Attendance Conflict | No | Resolves itself once HR2000 is corrected |
| Leave Data Error | No | Resolves itself once HR2000 is corrected |
| Pending Approval Hours | No | Someone must approve or reject the entry |

### What acknowledging actually means

**Acknowledging an absence declares the day unpaid.** It is a decision, not a
dismissal — the day still counts as an absence in every report, and the
Payroll Export still shows it. What acknowledging closes is the **review**, not
the fact.

Acknowledging insufficient half-day hours is different: it records that the
hours were reviewed and accepted. It does not change pay.

Only HR or a superadmin can undo an acknowledgement.

> **Why two categories cannot be acknowledged.** Leave conflicts and leave data
> errors come from the HR2000 leave ledger, which is re-synced on a schedule.
> Correcting the record upstream makes them disappear on their own. Suppressing
> them here would hide a problem that is still in the source data.

---

## 5. The filters you will actually use

| To find | Set |
|---|---|
| Everything outstanding this cycle | **Reconciliation → Needs Reconciliation** |
| People missing on days they should have been in | **Day Type → Absent** |
| Anything with a broken record | **Data Quality** (any value) |
| Entries waiting on approval | **Approval → Pending Approval** |
| Weekend or holiday work to pay | **Day Type → Weekend (Worked)** or **Public Holiday (Worked)** |

**Set a date range.** Without one the list shows a single day. With one it
searches the whole period — which is what you want when checking a payroll
cycle.

Filters combine. "Worked" + "Incomplete Card Scans" + "Pending Approval" is a
valid question and will return exactly those days.

---

## 6. Why there are two pages

They answer different questions from the same data.

| | **Attendance List** | **Payroll Export** |
|---|---|---|
| Question | *What happened on this day?* | *What do I hand payroll for this period?* |
| One row is | one employee, one day | one employee, the whole period |
| Use it to | investigate and fix individual days | check totals and export |

Work in the Attendance List. Confirm in Payroll Export.

---

## 7. Where the same words mean different numbers

This catches people out, and it is deliberate.

**"Hours Worked" on the Attendance List includes hours that are still awaiting
approval. "Hours Worked" on Payroll Export does not.**

Payroll Export shows only what is payable today. The difference between the two
is shown on that page as **Pending Approval Hours** — so if the totals look
lower than expected, that figure is the reason, and approving those entries
moves them across.

**Overtime is an estimate.** It is calculated from scans and app entries as
hours beyond 8 paid hours in a day, per the Employment Act. It is labelled
"(Est.)" because it is a reconciliation aid, not an overtime claim — HR
confirms actual overtime against the claim form.

**Weekend and holiday work shows zero overtime.** That is correct. Those days
are paid at their own rest-day and holiday rates rather than as normal hours
plus overtime, so they appear under the weekend and holiday figures instead.

---

## 8. Known quirks worth recognising

Things that are not bugs, but will look odd once:

- **A day with one card scan shows zero hours.** With only one scan there is
  nothing to measure between. The "Incomplete Card Scans" badge is the signal
  that the zero is *unknown*, not *none*.
- **Someone on extended leave or sabbatical accrues absences.** They are still
  counted as active staff, so a working day with no attendance reads as absent.
- **A new joiner may show absences before their start date**, and an employee
  whose status has just changed may disappear from past reports. Both are known
  limitations of how the roster is built.
- **A leave day recorded against a weekend** shows as "Weekend (On Leave)".
  Harmless — HR2000 permits it.

---

## Related

- `docs/hr/PAYROLL-DATA-REQUIREMENTS.md` — what payroll needs and where each
  figure comes from
- [`ATTENDANCE-NOTIFICATIONS.md`](./ATTENDANCE-NOTIFICATIONS.md) — what the
  portal sends, to whom, and when, across the whole lifecycle
- `docs/hr/ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md` — how employees fix their
  own attendance
- `docs/setup/ATTENDANCE-DAY-MODEL-DEPLOYMENT-GUIDE.md` — technical deployment
  notes and open issues
