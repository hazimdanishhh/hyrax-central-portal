import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "../../../../context/ProfileContext";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notificationsService";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";
import { useMessage } from "../../../../context/MessageContext";

const errorConfig = { entity: "notification" };

export default function useNotificationMutations() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();
  const { profile } = useProfile();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(profile?.id),
    onSuccess: invalidate,
    onError: (err) => showMessage(getFriendlyError(err, errorConfig), "error"),
  });

  return {
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
    markingRead: markReadMutation.isPending,
    markingAllRead: markAllReadMutation.isPending,
  };
}
