// features/employee/attendance/private/hooks/useTeamAttendanceSearch.js

import usePaginatedQuery from "@/hooks/usePaginatedQuery";
import { fetchTeamAttendanceSearch } from "../api/teamAttendanceService";

export default function useTeamAttendanceSearch({
  managerId,
  queryKey = "team_attendance_search",
  pageSize = 50,
  defaultSortBy = "work_date",
  defaultSortOrder = "descending",
  enabled = true,
}) {
  return usePaginatedQuery({
    queryKey,
    queryFn: fetchTeamAttendanceSearch(managerId),
    pageSize,
    defaultSortBy,
    defaultSortOrder,
    enabled: Boolean(managerId) && enabled,
  });
}
