// ⚠ PARKED 2026-10-23 -- NOT DEPLOYED, NOT USED (see
// src/pages/user/sales/reports/tabs/MeetingBrief.jsx).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMessage } from "../../../../../context/MessageContext";
import {
  fetchMeetingBrief,
  generateMeetingBrief,
} from "../api/fetchMeetingBrief";

/**
 * The Summary tab's AI Meeting Brief: the stored brief for this period and
 * salesperson, and a mutation that (re)generates it.
 */
export function useMeetingBrief({ startDate, endDate, owner }) {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();
  const key = ["salesMeetingBrief", { startDate, endDate, owner: owner || null }];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchMeetingBrief({ startDate, endDate, owner }),
    enabled: Boolean(startDate && endDate),
    staleTime: 60_000,
  });

  const generate = useMutation({
    mutationFn: () => generateMeetingBrief({ startDate, endDate, owner }),
    onMutate: () => showMessage("Writing the meeting brief…", "loading"),
    onSuccess: (result) => {
      showMessage(
        result?.reused
          ? "The brief was written less than 10 minutes ago — showing that one."
          : "Meeting brief ready.",
        "success",
      );
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (err) =>
      showMessage(`Couldn't write the brief: ${err.message ?? err}`, "error"),
  });

  return { ...query, generate };
}
