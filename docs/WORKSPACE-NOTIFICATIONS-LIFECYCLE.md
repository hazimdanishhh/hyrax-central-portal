# Workspace Notifications — Full Lifecycle

This is the end-to-end map of the Projects/Tasks/Documents module's lifecycle, with every point that carries (or could plausibly carry) a notification called out. It exists so the module's notification coverage can be reasoned about as a whole, not just as a growing list of individually-shipped events — see `docs/PROJECTS-TASKS-ARCHITECTURE.md` for the module itself and `docs/NOTIFICATIONS-ARCHITECTURE.md` for the generic event/rule/fan-out engine every event below plugs into.

**Legend**: 🟢 Implemented · 🔵 Built in this pass · 🟠 Proposed (tracked, not built) · 🟣 Designed as a future feature, not built · ⬛ Considered and deliberately left out

## Project lifecycle

```mermaid
flowchart TD
    classDef implemented fill:#1b5e20,color:#fff,stroke:#0d3010
    classDef building fill:#0d47a1,color:#fff,stroke:#082a5e
    classDef leaveout fill:#616161,color:#fff,stroke:#333333,stroke-dasharray: 4 3

    P1[Project created\ncreator becomes owner] --> P2{Initial members\nadded at creation?}
    P2 -->|yes| N1(["🟢 project.member_added\nper member"]):::implemented
    P2 --> P3[PLANNING]
    P3 -->|first task starts IN_PROGRESS| P4[ACTIVE]
    P3 -->|manual| P5[ON_HOLD / COMPLETED / CANCELLED]
    P4 -->|manual| P5
    P3 & P4 & P5 -->|any status change| N2(["🟢 project.status_changed\nall members"]):::implemented
    P3 & P4 --> P6[Member added later] --> N1
    P6 --> P7[Member removed] --> N3(["🔵 project.member_removed"]):::building
    P6 --> P8[Member role tier changed] --> N4(["🔵 project.member_role_changed\nexcludes owner transitions"]):::building
    P6 --> P9[Ownership transferred] --> N5(["🔵 project.ownership_transferred\nnew owner only"]):::building
    P3 & P4 --> P10{target_end_date\napproaching / passed?}
    P10 -->|~3 days out| N6(["🔵 project.deadline_approaching\nall members"]):::building
    P10 -->|overdue, 7-day recheck| N7(["🔵 project.overdue\nall members"]):::building
    P11[target_end_date rescheduled] -.->|silently resets cooldowns, no event| P10
    P5 --> P12["Project deleted\n(CANCELLED + taskless only)"] -.-> LO1["⬛ Leave out: no active\nstakeholders left by then"]:::leaveout
```

## Task lifecycle

```mermaid
flowchart TD
    classDef implemented fill:#1b5e20,color:#fff,stroke:#0d3010
    classDef building fill:#0d47a1,color:#fff,stroke:#082a5e
    classDef future fill:#6a1b9a,color:#fff,stroke:#3d0f57

    T1[Task created] --> T2{Assignees set?}
    T2 -->|yes| NT1(["🟢 task.assigned\nper assignee"]):::implemented
    T2 --> T3[TO_DO]
    T1 -.->|CC'd users tagged| NTC1(["🟣 task.cc_added"]):::future
    T3 -->|assignee added later| NT1
    T3 -->|assignee removed| NT2(["🔵 task.unassigned"]):::building
    T3 -.->|CC removed| NTC2(["🟣 task.cc_removed"]):::future
    T3 --> T4[IN_PROGRESS] --> T5[COMPLETED]
    T4 --> T6[CANCELLED]
    T3 --> T6
    T5 -->|Revert| T4
    T3 & T4 & T5 & T6 -->|any transition| NT3(["🟢 task.status_changed\ncurrent assignees today;\n+ CC once that ships"]):::implemented
    T3 & T4 -->|due_date edited| NT4(["🔵 task.due_date_changed\nresets due-soon/overdue cooldowns"]):::building
    T3 & T4 --> T7{due_date\napproaching / passed?}
    T7 -->|~3 days out, per assignee| NT5(["🔵 task.due_soon"]):::building
    T7 -->|overdue, 7-day recheck, per assignee| NT6(["🔵 task.overdue"]):::building
    T3 & T4 & T5 & T6 --> T8[Task deleted] --> NT7(["🔵 task.deleted\ncurrent assignees"]):::building
    T3 & T4 --> T9[Comment posted] --> NT8(["🟣 task.comment_added\nassignees + CC + owner/lead"]):::future
```

## Document lifecycle

```mermaid
flowchart TD
    classDef implemented fill:#1b5e20,color:#fff,stroke:#0d3010
    classDef building fill:#0d47a1,color:#fff,stroke:#082a5e
    classDef proposed fill:#e65100,color:#fff,stroke:#8f3300
    classDef leaveout fill:#616161,color:#fff,stroke:#333333,stroke-dasharray: 4 3

    D1[Drive file picked] --> D2{Attach point?}
    D2 -->|"Task-level: link to a task"| D3["documents row +\ntask_documents row"]
    D3 --> ND1(["🟢 document.attached\ntask's current assignees;\n+ CC once that ships"]):::implemented
    D2 -->|"Project-level only: library attach"| D4["documents row only"]
    D4 -.-> ND2(["🟠 document.added_to_project"]):::proposed
    D3 & D4 --> D5["Document removed\n(uploader or elevated member)"] --> ND3(["🔵 document.removed\nnotifies original uploader"]):::building
    D3 --> D6["Unlinked from a task\n(doc stays in library)"] -.-> LO2["⬛ Leave out: still visible\nin the project library"]:::leaveout
```

## Notes on the decisions behind this map

- **Due-soon / deadline-approaching window: 3 days.** Applies to `task.due_soon` and `project.deadline_approaching`. `task.overdue`/`project.overdue` then re-notify every 7 days until resolved (matches `check_employee_confirmations_overdue.sql`'s own recurring-cooldown cadence).
- **Dynamic multi-recipient audience for the project-level deadline events is "all project members," any role including `cc`** — matches `project.status_changed`'s existing precedent (`cc` exists specifically to stay informed).
- **`document.added_to_project`** (a document attached at the project-library level, with no task link) is deliberately left `Proposed` — correctly distinguishing it from a doc that gets task-linked moments later needs a short-delay scheduled scan, not an instant trigger, and wasn't judged worth the added latency/complexity yet.
- **`project.created`** was considered and explicitly dropped — every real stakeholder is already covered by `project.member_added` firing per initial member at creation time.
- **A task created with a due date already inside the 3-day window** isn't special-cased — the very next scheduled scan run already matches it (the condition is satisfied from the moment the row exists), and `task.assigned`'s own notification message surfaces the due date immediately regardless of scan timing.
- **Silent cooldown resets** (project deadline rescheduled, task due date rescheduled) intentionally carry no visible notification of their own — only clear the reminder state so the new date gets a fresh cycle. Adding a separate "deadline changed" notification on top was weighed and left out to avoid over-notifying.
- **Task CC and Task Comments** are new capabilities the module doesn't have yet — designed in `docs/TASK-CC-DESIGN.md` and `docs/TASK-COMMENTS-DESIGN.md`, not implemented in this pass. Once built, `task.status_changed` and `document.attached`'s recipient loops extend to include CC'd users (documented as a follow-up in the Task CC design doc).

## Fixed alongside this pass

The five originally-shipped Workspace `notify_*` functions (`task.assigned`, `project.member_added`, `task.status_changed`, `project.status_changed`, `document.attached`) were not `security definer` — meaning the `employees` lookup used to resolve a *target's* `profile_id` ran under the *acting* user's own RLS, which only grants self/HR/superadmin/direct-manager visibility into `employees`. An ordinary "member" notifying another ordinary "member" they aren't managing would silently resolve to no recipient and never fire. All five, plus every new function in this pass, are now `security definer set search_path = ''`.
