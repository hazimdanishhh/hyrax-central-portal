// features/hr/attendance/private/hooks/useAttendanceLogScans.js

import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceLogScans } from "../api/attendanceLogScansService";
import { formatTime } from "@/functions/formatDate";

// Lazy-fetch-on-expand, matching ProjectDocumentsIndicator.jsx's convention
// -- `enabled` should be the card's own expanded state, so nothing fetches
// until the user actually clicks to verify.
export default function useAttendanceLogScans({
  employeeCode,
  scannerLocation,
  workDate,
  enabled,
}) {
  const query = useQuery({
    queryKey: [
      "attendance_log_scans",
      employeeCode,
      scannerLocation,
      workDate,
    ],
    queryFn: () =>
      fetchAttendanceLogScans({ employeeCode, scannerLocation, workDate }),
    enabled: Boolean(enabled && employeeCode && scannerLocation && workDate),
  });

  const scans = (query.data || []).map((row) => ({
    ...row,
    scanned_at_time: formatTime(row.scanned_at),
  }));

  return {
    scans,
    isLoading: query.isLoading,
    error: query.error,
  };
}
