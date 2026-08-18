/**
 * Shared overdue/due-soon classifier for any {date, status} pair with a
 * "target/deadline" semantic -- projects.target_end_date, tasks.due_date.
 * Mirrors the exact "due soon = within 3 days" / "COMPLETED and CANCELLED
 * items are never overdue" rules already established (and previously
 * duplicated) in myTasksService.js's dueStatus filter and
 * get_my_tasks_overview_rpc.sql -- one definition, not a 3rd reimplementation.
 *
 * Plain "YYYY-MM-DD" string comparison, not Date-object arithmetic -- these
 * `date` columns round-trip through supabase-js as bare ISO date strings
 * with no time/timezone component, and ISO 8601 date strings compare
 * correctly with plain string operators, sidestepping any
 * local-timezone-vs-UTC-midnight drift `new Date(dateStr)` parsing could
 * introduce.
 *
 * Deliberately takes the raw date value AND the item's own status (rather
 * than only the date) so ProjectCard/ProjectDetailLayout/TaskCard can call
 * it identically and each item suppresses its own overdue/due-soon state
 * for a completed/cancelled row, instead of every call site having to
 * remember that rule itself.
 */
export const DUE_SOON_WINDOW_DAYS = 3;

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED"];

export function getDueDateStatus(dateValue, itemStatus) {
  if (!dateValue || TERMINAL_STATUSES.includes(itemStatus)) {
    return { state: "none", colorClass: "blue", isOverdue: false, isDueSoon: false };
  }

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const targetDate = String(dateValue).slice(0, 10);

  if (targetDate < today) {
    return { state: "overdue", colorClass: "red", isOverdue: true, isDueSoon: false };
  }
  if (targetDate <= cutoff) {
    return { state: "due_soon", colorClass: "yellow", isOverdue: false, isDueSoon: true };
  }
  return { state: "normal", colorClass: "blue", isOverdue: false, isDueSoon: false };
}
