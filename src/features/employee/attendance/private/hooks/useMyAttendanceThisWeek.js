// features/employee/attendance/private/hooks/useMyAttendanceThisWeek.js

import { useQuery } from "@tanstack/react-query";
import { useEmployee } from "@/context/EmployeeContext";
import { fetchMyAttendanceThisWeek } from "../api/myAttendanceService";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Monday of the current calendar week (local time).
function getWeekStart(date) {
  const day = date.getDay(); // 0 (Sun) - 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  return monday;
}

/**
 * Backs the Dashboard "Today's Attendance" card and ClockinMini's hybrid
 * status fallback -- both must call this same hook (not hand-roll their own
 * date math) so React Query dedupes the request via one identical query key.
 *
 * Monday-through-today, current ISO calendar week -- deliberately not a
 * rolling 7-day window (matches how the rest of the app already frames
 * "this week", e.g. payroll-cycle framing). On a Monday the chart legitimately
 * shows one bar -- that's correct, not a bug.
 */
export default function useMyAttendanceThisWeek() {
  const { employee } = useEmployee();
  const employeeId = employee?.id;

  const now = new Date();
  const weekStartISO = toISODate(getWeekStart(now));
  const todayISO = toISODate(now);

  const query = useQuery({
    queryKey: ["my_attendance_this_week", employeeId, weekStartISO],
    queryFn: () =>
      fetchMyAttendanceThisWeek(employeeId)({ weekStartISO, todayISO }),
    enabled: Boolean(employeeId),
    staleTime: 60 * 1000,
    // Overrides the app-wide refetchOnWindowFocus:false default (see
    // src/lib/reactQuery.js) -- a biometric door scan can silently close an
    // open app session server-side (trigger_auto_clock_out.sql), so this
    // needs to self-refresh on focus rather than only on staleTime/remount.
    refetchOnWindowFocus: true,
  });

  const weekRows = query.data || [];
  const today = weekRows.find((row) => row.work_date === todayISO) ?? null;

  const totalHoursThisWeek = weekRows.reduce(
    (sum, row) => sum + (Number(row.hours_worked) || 0),
    0,
  );

  const chartData = weekRows.map((row) => ({
    name: WEEKDAY_LABELS[new Date(row.work_date).getDay()],
    value: Number(row.hours_worked) || 0,
  }));

  return {
    today,
    weekRows,
    totalHoursThisWeek,
    chartData,
    isLoading: query.isLoading,
    error: query.error,
  };
}
