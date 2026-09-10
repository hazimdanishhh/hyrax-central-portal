// features/hr/attendance/private/hooks/useAttendanceLogScans.js

import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceLogScans } from "../api/attendanceLogScansService";
import { formatTime } from "@/functions/formatDate";

// `enabled` is caller-controlled (matching ProjectDocumentsIndicator.jsx's
// lazy-fetch convention for the concept in general). AttendanceTimelineCard.jsx
// currently passes `activity.event_source === "Hardware"` -- fetched eagerly
// for every Hardware row, not lazily, since its odd/even in-out pair
// breakdown (built from these scans) is that card's primary content, not a
// click-to-reveal extra. The "Show Raw Scan Log" toggle there only gates
// whether the fully raw list is DISPLAYED, not whether this hook fetches.
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
