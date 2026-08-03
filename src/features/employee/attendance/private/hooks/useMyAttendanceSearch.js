// features/employee/attendance/private/hooks/useMyAttendanceSearch.js

import usePaginatedQuery from "@/hooks/usePaginatedQuery";
import { fetchMyAttendanceSearch } from "../api/myAttendanceService";

export default function useMyAttendanceSearch({
  employeeId,
  queryKey = "my_attendance_search",
  pageSize = 50,
  defaultSortBy = "work_date",
  defaultSortOrder = "descending",
  enabled = true,
}) {
  return usePaginatedQuery({
    queryKey,
    queryFn: fetchMyAttendanceSearch(employeeId),
    pageSize,
    defaultSortBy,
    defaultSortOrder,
    enabled: Boolean(employeeId) && enabled,
  });
}
