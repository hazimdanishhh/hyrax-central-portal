import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "../../../../context/ProfileContext";
import { supabase } from "../../../../lib/supabaseClient";

// One subscription per signed-in session (mounted once in AppLayout.jsx) --
// every notification hook keys off "notifications", so invalidating that
// prefix here is all any of them need to refresh instantly.
export function useNotificationsRealtime() {
  const { profile } = useProfile();
  const userId = profile?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        invalidate,
      )
      // Fires on first connect AND every reconnect (dropped network, tab
      // resumed from background, etc.) -- a cheap, event-driven way to
      // catch up on anything missed while disconnected, instead of a
      // periodic timer.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") invalidate();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
