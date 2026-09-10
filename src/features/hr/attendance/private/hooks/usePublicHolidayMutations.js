import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPublicHoliday,
  updatePublicHoliday,
  deletePublicHoliday,
} from "../api/publicHolidaysService";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = {
  entity: "public holiday",
  constraints: {
    public_holidays_location_date_idx:
      "A holiday already exists for this location on this date.",
  },
};

export default function usePublicHolidayMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["public_holidays"] });

  const createMutation = useMutation({
    mutationFn: createPublicHoliday,
    onMutate: () => showMessage("Creating holiday...", "loading"),
    onSuccess: () => {
      showMessage("Holiday created", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const updateMutation = useMutation({
    mutationFn: updatePublicHoliday,
    onMutate: () => showMessage("Updating holiday...", "loading"),
    onSuccess: () => {
      showMessage("Holiday updated", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePublicHoliday,
    onMutate: () => showMessage("Deleting holiday...", "loading"),
    onSuccess: () => {
      showMessage("Holiday deleted", "success");
      invalidate();
    },
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  return {
    createHoliday: createMutation.mutateAsync,
    updateHoliday: updateMutation.mutateAsync,
    deleteHoliday: deleteMutation.mutateAsync,

    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
