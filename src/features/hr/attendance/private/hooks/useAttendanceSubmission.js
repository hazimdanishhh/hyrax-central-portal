import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAttendanceSubmission } from "../api/attendanceSubmissionService";
import { useMessage } from "@/context/MessageContext";
import { uploadAttendancePhoto } from "@/services/storage/uploadAttendancePhoto";

/**
 * Commit one attendance submission: upload the evidence once, then write one
 * row per date.
 *
 * NEW, alongside useAttendanceBackfill rather than replacing it.
 *
 * THE UPLOAD LIVES HERE, not in the component. Two reasons:
 *   - it must happen BEFORE the RPC call, and every surface that mounts this
 *     form would otherwise have to remember that ordering;
 *   - the failure modes differ and only one of them is recoverable. An upload
 *     that fails has written nothing, so the form can simply be retried. An
 *     RPC that fails after a successful upload has left an object in the
 *     bucket with no row referencing it (see below).
 *
 * ORPHANED OBJECTS, stated rather than silently accepted: if the RPC throws
 * after the upload succeeds, the storage object is stranded. It is not
 * deleted here, because a compensating delete that itself fails would leave
 * the user staring at a second error about something they never asked for.
 * photo_path is what makes a later sweep possible; deleteAttendancePhoto.js
 * exists and is still called by nothing.
 */
export default function useAttendanceSubmission() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const mutation = useMutation({
    mutationFn: async ({ photo, ...submission }) => {
      let photoUrl = null;
      let photoPath = null;

      // ONE upload, however many dates. Every created row references the same
      // object -- which is the honest shape for "one piece of evidence
      // covering four days", and means deleting one day cannot strand the
      // others' evidence.
      if (photo) {
        const uploaded = await uploadAttendancePhoto(photo, submission.employeeId);
        photoUrl = uploaded.url;
        photoPath = uploaded.path;
      }

      return createAttendanceSubmission({ ...submission, photoUrl, photoPath });
    },

    onMutate: () => showMessage("Recording attendance...", "loading"),

    onSuccess: (data) => {
      const added = data?.addedCount ?? 0;
      const skipped = data?.skippedCount ?? 0;

      // A skip is a normal outcome, not a failure -- an already-recorded day
      // is exactly what someone re-submitting a partly-entered trip will hit.
      // Reporting both counts in one message avoids a green toast that quietly
      // hides three dropped dates.
      if (added === 0) {
        showMessage(
          skipped > 0
            ? `Nothing added -- ${skipped} date${skipped === 1 ? "" : "s"} already recorded.`
            : "Nothing was added.",
          "error",
        );
      } else {
        showMessage(
          skipped > 0
            ? `${added} day${added === 1 ? "" : "s"} recorded, ${skipped} skipped.`
            : `${added} day${added === 1 ? "" : "s"} recorded.`,
          "success",
        );
      }

      // The same three keys every other attendance write invalidates -- day
      // mode's roster, search mode's list, and the sidebar's own per-day
      // timeline. Only one is active at a time; the others are disabled and
      // will not refetch.
      queryClient.invalidateQueries({ queryKey: ["attendance_daily"] });
      queryClient.invalidateQueries({ queryKey: ["attendance_search"] });
      queryClient.invalidateQueries({ queryKey: ["attendance_activities"] });
      queryClient.invalidateQueries({ queryKey: ["my_attendance_this_week"] });
      queryClient.invalidateQueries({ queryKey: ["my_current_status"] });
    },

    onError: (err) => {
      // The RPC raises plain messages by design ("A half day cannot exceed 4
      // hours", "Site Visit requires a photo") -- they are written to be shown
      // verbatim, so do not swap them for a generic one.
      showMessage(
        err?.message || "Could not record this attendance. Please try again.",
        "error",
      );
    },
  });

  return {
    submitAttendance: mutation.mutateAsync,
    submitting: mutation.isPending,
  };
}
