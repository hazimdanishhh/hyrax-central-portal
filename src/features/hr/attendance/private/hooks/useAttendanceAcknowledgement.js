import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeAttendanceDay,
  revokeAttendanceDayAcknowledgement,
  fetchAcknowledgementReasons,
  fetchDayAcknowledgements,
} from "../api/attendanceAcknowledgementService";
import { useMessage } from "@/context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "acknowledgement" };

// Everything a resolved flag changes. Note payroll_period_summary is in here:
// acknowledging doesn't alter daysAbsentCount, but it does alter the
// unacknowledged* counts that drive the row badge and the "Needs
// Reconciliation" filter, so the Payroll Export table has to refetch.
const ACKNOWLEDGEMENT_QUERY_KEYS = [
  ["attendance_day_acknowledgements"],
  ["payroll_period_summary"],
  ["payroll_reconciliation_detail"],
  ["attendance_daily"],
  ["attendance_search"],
  ["my_attendance_daily"],
  ["my_attendance_search"],
  ["team_attendance_daily"],
  ["team_attendance_search"],
];

/** The reason vocabulary. Lookup data -- long staleTime. */
export function useAcknowledgementReasons(category) {
  const query = useQuery({
    queryKey: ["attendanceAcknowledgementReasons"],
    queryFn: fetchAcknowledgementReasons,
    staleTime: 1000 * 60 * 30,
  });

  const all = query.data || [];

  return {
    ...query,
    // Scoped client-side rather than by a server filter: the whole list is a
    // handful of rows, one fetch serves every category, and the server
    // re-checks applicable_categories on write regardless.
    reasons: category
      ? all.filter((r) => (r.applicable_categories || []).includes(category))
      : all,
  };
}

/** Acknowledgements already recorded for one employee-day. */
export function useDayAcknowledgements({ employeeId, workDate, enabled = true }) {
  const query = useQuery({
    queryKey: ["attendance_day_acknowledgements", employeeId, workDate],
    queryFn: () => fetchDayAcknowledgements({ employeeId, workDate }),
    enabled: Boolean(enabled && employeeId && workDate),
  });

  return { ...query, acknowledgements: query.data || [] };
}

export default function useAttendanceAcknowledgementMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  function invalidateAll() {
    for (const queryKey of ACKNOWLEDGEMENT_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey });
    }
  }

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeAttendanceDay,
    onSuccess: (data) => {
      // The RPC is idempotent -- two people closing the same day is not a
      // failure, so say so plainly rather than claiming a write that didn't
      // happen.
      showMessage(
        data?.status === "already_acknowledged"
          ? "This day was already acknowledged"
          : "Day acknowledged",
        "success",
      );
      invalidateAll();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeAttendanceDayAcknowledgement,
    onSuccess: () => {
      showMessage("Acknowledgement revoked", "success");
      invalidateAll();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  return {
    acknowledgeDay: acknowledgeMutation.mutateAsync,
    acknowledging: acknowledgeMutation.isPending,
    revokeAcknowledgement: revokeMutation.mutateAsync,
    revoking: revokeMutation.isPending,
  };
}
