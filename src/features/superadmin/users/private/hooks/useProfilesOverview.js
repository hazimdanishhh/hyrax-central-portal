import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchProfilesOverview } from "../api/profilesOverview";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function useProfilesOverview() {
  const query = useQuery({
    queryKey: ["usersOverview"],
    queryFn: fetchProfilesOverview,
    staleTime: 1000 * 60 * 5,
  });

  const data = query.data || [];

  const unassignedProfiles = useMemo(
    () => data.filter((p) => p.department_id === 1),
    [data],
  );

  const notLinkedProfiles = useMemo(
    () => data.filter((p) => !p.isLinkedToEmployee),
    [data],
  );

  const recentlyCreatedProfiles = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    return data.filter(
      (p) => p.created_at && new Date(p.created_at).getTime() >= cutoff,
    );
  }, [data]);

  const kpis = useMemo(
    () => ({
      totalUsers: data.length,
      unassignedCount: unassignedProfiles.length,
      notLinkedCount: notLinkedProfiles.length,
      recentlyCreatedCount: recentlyCreatedProfiles.length,
    }),
    [
      data,
      unassignedProfiles,
      notLinkedProfiles,
      recentlyCreatedProfiles,
    ],
  );

  return {
    ...query,
    unassignedProfiles,
    notLinkedProfiles,
    recentlyCreatedProfiles,
    kpis,
  };
}
