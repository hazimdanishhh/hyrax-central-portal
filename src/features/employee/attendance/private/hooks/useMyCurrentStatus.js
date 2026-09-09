// features/employee/attendance/private/hooks/useMyCurrentStatus.js

import { useQuery } from "@tanstack/react-query";
import { useEmployee } from "@/context/EmployeeContext";
import { fetchEmployeePublicById } from "@/features/hr/employees/public/api/employeePublic";

/**
 * Live "current status" -- combines whichever of {open app session, most
 * recent biometric scan, approved leave} happened most recently today,
 * already computed server-side on employees_public.current_status (see
 * that view's own CASE logic in employees_public_view.sql). This is the
 * only source that can show a scanner-based "Office"/"Blending Plant"
 * status -- app clock-ins are remote-only now, so
 * unified_daily_attendance's daily_activities can never represent an
 * on-site day.
 *
 * Shared by TodayAttendanceCard and ClockinMini so nav and dashboard never
 * disagree -- both call this hook rather than querying independently.
 */
export default function useMyCurrentStatus() {
  const { employee } = useEmployee();
  const employeeId = employee?.id;

  const query = useQuery({
    queryKey: ["my_current_status", employeeId],
    queryFn: () => fetchEmployeePublicById(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 30 * 1000,
    // employees_public is a real-time snapshot -- overrides the app-wide
    // refetchOnWindowFocus:false default (src/lib/reactQuery.js) since a
    // single new scan/clock-in can change it with no elapsed-time
    // component at all.
    refetchOnWindowFocus: true,
  });

  return {
    currentStatus: query.data?.current_status ?? null,
    lastStatusTime: query.data?.last_status_time ?? null,
    firstArrivalTime: query.data?.first_arrival_time ?? null,
    isOnLeaveToday: query.data?.is_on_leave_today ?? false,
    leaveTypeCodesToday: query.data?.leave_type_codes_today ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
