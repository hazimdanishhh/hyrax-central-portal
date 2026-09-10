# Payroll Data Requirements

Research/checklist doc, written before any payroll-facing RPC or dashboard design begins — not an implementation plan. Cross-references what a real payroll run needs, per employee per pay cycle, against what actually exists in this schema today (`hyrax-central-portal` + `hyrax-data-platform`), so future RPC/dashboard work can be scoped against real gaps instead of assumptions.

## Strategic direction (decided)

Two very different things could be meant by "build this so HR can run payroll":

1. **A full in-house payroll engine** — this app computes net pay, EPF/SOCSO/PCB, and disbursement files itself. Needs essentially all of the MISSING data below built from scratch, plus statutory calculation logic where an error has real legal/financial consequences.
2. **A Payroll Input Package** — a clean, complete, per-employee-per-cycle extract of everything this system can correctly and reliably compute (hours worked, overtime, paid/unpaid leave days, unresolved anomalies), which HR hands off to whatever actually calculates and disburses pay (HR2000 or another external system today).

**Decided: (2), the Payroll Input Package.** Nothing in the current architecture points toward this app being the payroll system of record — `docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md` explicitly confirms "no payroll engine exists anywhere in this app" and that final settlement / statutory-benefits cessation are manual HR confirmations today. `get_attendance_dashboard_rpc.sql`'s own header comment already frames the Attendance Overview as meant "for payroll prep," not for running payroll itself. Every recommendation below is scoped to (2).

## 1. Employee master data (relatively static)

| Data                                                                                                   | Status      | Where                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full legal name, IC/passport number                                                                    | **EXISTS**  | `employees.identification_number`, `identification_type_id`                                                                                                           |
| Date of birth (EPF/SOCSO age-based rate eligibility)                                                   | **EXISTS**  | `employees.date_of_birth`                                                                                                                                             |
| Marital status                                                                                         | **EXISTS**  | `employees.marital_status`                                                                                                                                            |
| Nationality                                                                                            | **EXISTS**  | `employees.nationality_id`                                                                                                                                            |
| Residency status (tax-resident vs non-resident — changes PCB treatment)                                | **MISSING** | —                                                                                                                                                                     |
| Bank name + account number                                                                             | **MISSING** | —                                                                                                                                                                     |
| EPF number (KWSP)                                                                                      | **MISSING** | —                                                                                                                                                                     |
| SOCSO/EIS number (PERKESO)                                                                             | **MISSING** | —                                                                                                                                                                     |
| Income tax reference number (PCB/MTD)                                                                  | **MISSING** | —                                                                                                                                                                     |
| Dependents/children count, spouse working status (PCB relief inputs)                                   | **MISSING** | —                                                                                                                                                                     |
| Employment type w/ statutory treatment (permanent/contract/probation — some categories are EPF-exempt) | **PARTIAL** | `employment_type` lookup table exists, no seed values or statutory flags. `employment_status.category` is an operational active/inactive/terminated bucket, not this. |
| Basic salary, salary structure, fixed allowances, pay grade, effective-dated salary history            | **MISSING** | No compensation table anywhere in either repo                                                                                                                         |
| Department/cost center → GL account mapping                                                            | **PARTIAL** | `department_id` exists; no GL/cost-center mapping                                                                                                                     |

**Confirmed off-system today**: bank details/EPF/SOCSO are collected as a manual, off-system onboarding step (`EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md`'s `hr_documents_collected` checklist item) — never stored in this database.

## 2. Per-cycle attendance data

| Data                                                                                                                                          | Status                         | Where                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total hours worked, days present                                                                                                              | **EXISTS**                     | `unified_daily_attendance.hours_worked`, `hr_flag`                                                                                                                |
| Days absent (unexcused)                                                                                                                       | **EXISTS, with a caveat**      | `hr_flag = 'Absent'` — **no longer sufficient on its own**: since weekend was made an independent `is_weekend` flag (removed from `hr_flag` entirely), an unworked weekend also reads `hr_flag = 'Absent'`. Any extract must add `and not is_weekend` (and `not is_public_holiday`, for the same reason) or it will count every unworked Saturday/Sunday as an unexcused absence. |
| Overtime hours (raw, after 6PM)                                                                                                               | **EXISTS**                     | `overtime_hours` — the window's start is bounded to the later of (actual first arrival, 6PM); previously it wasn't, so a day whose entire attendance started after 6PM (e.g. clocked in 9PM, out 11PM) miscounted 5h of overtime instead of the real 2h. Fixed in `hr_unified_daily_attendance_view.sql`. |
| OT classified by normal/rest-day/public-holiday (different statutory multipliers, 1.5x/2x/3x under the Employment Act)                        | **PARTIAL**                    | The classification data now exists (`is_weekend`, `is_public_holiday`, `weekend_hours_worked`, `holiday_hours_worked` all on `unified_daily_attendance`) — what's still missing is the statutory rate/multiplier table itself, so this app can identify *which* hours were rest-day/holiday OT but can't yet compute the payable amount. |
| Days requiring resolution before payroll can trust the hours (pending approval, missing checkout, incomplete scan, leave/attendance conflict) | **EXISTS**                     | `hr_flag`, `is_leave_attendance_conflict`, `is_insufficient_half_day_hours`, `has_leave_fraction_error`                                                          |
| Late arrival / early leave                                                                                                                    | **EXISTS**, informational only | `is_late_arrival`, `is_early_leave` — now correctly excluded on weekends/public holidays (no policy yet for whether these should ever produce a pay deduction on a real working day) |

## 3. Per-cycle leave data

| Data                                                                                        | Status                                 | Where                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Paid leave days by type this cycle                                                          | **EXISTS**                             | `leave_day_fraction`, `leave_type_codes`                                                                                                      |
| Unpaid (No-Pay Leave) days this cycle                                                       | **EXISTS**, unconfirmed classification | `unpaid_leave_day_fraction` — but `leave_ledger_types.is_paid` is an unconfirmed guess for nearly every type (`needs_hr_confirmation = true`) |
| Leave balance / entitlement carry-forward (annual-leave encashment on resignation)          | **PARTIAL**                            | Live balance can be shown from `leave_ledger_entries`; actual encashment/settlement is a manual HR confirmation, no calculation               |
| Maternity/paternity/hospitalization leave (statutory, fully paid, needs correct day counts) | **PARTIAL**                            | Codes exist (`MTL`, `PTL`, `HPL`), all `needs_hr_confirmation = true`                                                                         |

## 4. Statutory compliance data (Malaysia-specific)

**All MISSING**: EPF employee/employer rate table, SOCSO contribution-category table, EIS, PCB tax-bracket/relief table, HRDF levy. No government-mandated contribution math has anywhere to live today, independent of how good the attendance/leave data gets.

## 5. Earnings, allowances, deductions

**All MISSING**: fixed/variable allowances, commission/bonus, claims/reimbursements, staff loan/advance recovery, ad hoc deductions, zakat. No table of any kind.

## 6. Payroll cycle administration

| Data                                                                                        | Status      | Where                                                                                                                                               |
| ------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmed pay-period cutoff                                                                 | **PARTIAL** | `payrollCyclePresets.js` implements a 26th-to-25th cycle; its own comment flags the start day as an unconfirmed placeholder pending HR confirmation |
| Public holiday calendar (classify OT correctly, distinguish holiday from unexcused absence) | **EXISTS** | `public_holidays` table (the old dead `leave_holidays` table this row used to reference was dropped) — cross-checked against real attendance via `is_public_holiday`/`is_worked_on_holiday`/`holiday_hours_worked` on `unified_daily_attendance`. Still missing: the statutory multiplier rate table itself (see the OT classification row above). |
| Period lock/freeze (so payroll doesn't run on data that changes afterward)                  | **MISSING** | —                                                                                                                                                   |
| New joiners/leavers this cycle (pro-ration, first/last month handling)                      | **PARTIAL** | Hire/termination dates exist on `employees`; no pro-ration logic anywhere                                                                           |
| Payslip / payroll-run / bank-disbursement-file structure                                    | **MISSING** | —                                                                                                                                                   |

## Recommended phasing (once design starts — not part of this doc's scope)

1. **Buildable now, from data that already exists**: a Payroll Period Summary — per employee, per confirmed cycle: hours worked, days present/absent, overtime hours, paid/unpaid leave days by type, and every unresolved anomaly flag that must be cleared before HR can trust the cycle's numbers.
2. **Needs small, well-scoped additions**: the public holiday calendar (§6) now exists — what's left is the statutory OT multiplier rate table to classify normal/rest-day/public-holiday overtime correctly, a confirmed (not placeholder) pay-period cutoff, a period lock/freeze mechanism, and a real row-level export (CSV/Excel) — the actual handoff artifact HR would use.
3. **Needs HR/payroll sign-off before it can be trusted, not more code**: `is_paid` per leave type, the OT rate multipliers, whether late/absence ever produces a deduction, the real pay-cycle cutoff day.
4. **Out of scope for this app** (per the decided direction): salary/compensation data, EPF/SOCSO/bank/tax master data, statutory rate tables, net-pay calculation, bank disbursement files. These belong to whatever system already does payroll disbursement today (HR2000 or similar) — this app's job is to hand that system a complete, correct, per-employee attendance/leave summary, not to replace it.
