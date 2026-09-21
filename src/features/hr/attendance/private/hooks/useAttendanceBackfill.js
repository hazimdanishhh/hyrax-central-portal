import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  previewAttendanceBackfill,
  commitAttendanceBackfill,
} from "../api/attendanceBackfillService";
import { useMessage } from "@/context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "attendance record" };

// Every cached view of attendance this write can invalidate. The union of all
// three list pages' own invalidation lists (HR / My / Team) plus
// useClockInOutAction's two -- because the same wizard writes from all three
// surfaces, and a manager's backfill for a subordinate must also refresh that
// subordinate's own My Attendance if they happen to have it open.
const ATTENDANCE_QUERY_KEYS = [
  ["attendance_daily"],
  ["attendance_search"],
  ["attendance_activities"],
  ["my_attendance_daily"],
  ["my_attendance_search"],
  ["team_attendance_daily"],
  ["team_attendance_search"],
  ["my_attendance_this_week"],
  ["my_current_status"],
  ["my_attendance_day_details"],
];

export default function useAttendanceBackfill() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  // Preview deliberately has no toast and no invalidation -- it writes
  // nothing. Same reasoning useLeaveImportMutation documents for its own dry
  // run: the wizard's preview step already shows the outcome in full, and a
  // success toast for "nothing happened" is actively misleading.
  const previewMutation = useMutation({
    mutationFn: previewAttendanceBackfill,
    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  const commitMutation = useMutation({
    mutationFn: commitAttendanceBackfill,
    onMutate: () => {
      showMessage("Adding attendance records", "loading");
    },
    onSuccess: (data) => {
      const added = data?.addedCount ?? 0;
      showMessage(
        `${added} attendance record${added === 1 ? "" : "s"} added`,
        "success",
      );
      for (const queryKey of ATTENDANCE_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  return {
    runPreview: previewMutation.mutateAsync,
    previewing: previewMutation.isPending,
    runCommit: commitMutation.mutateAsync,
    committing: commitMutation.isPending,
  };
}
