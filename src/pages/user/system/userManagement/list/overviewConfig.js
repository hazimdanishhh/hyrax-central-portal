import {
  LinkBreakIcon,
  UserPlusIcon,
  UsersIcon,
  WarningIcon,
} from "@phosphor-icons/react";

// Cards render at the top of this same page (no separate Overview route),
// so "Unassigned" links back to this exact page with the filter applied --
// not OverviewCards' usual "../list" default, which assumed a sibling list
// route that no longer exists here.
export function getUsersOverviewConfig(kpis) {
  return [
    {
      label: "Total Users",
      value: kpis.totalUsers,
      icon: UsersIcon,
      variant: "blueCardFill",
      filter: null,
      to: "/app/system/users",
    },
    {
      label: "Unassigned (General Dept)",
      value: kpis.unassignedCount,
      icon: WarningIcon,
      variant: kpis.unassignedCount > 0 ? "redCard" : "greenCard",
      to: "/app/system/users",
      filter: { department: 1 },
    },
    {
      label: "Not Linked to Employee",
      value: kpis.notLinkedCount,
      icon: LinkBreakIcon,
      variant: kpis.notLinkedCount > 0 ? "redCard" : "greenCard",
      filter: null,
      to: "/app/system/users",
    },
    {
      label: "Recently Created (7d)",
      value: kpis.recentlyCreatedCount,
      icon: UserPlusIcon,
      variant: "blueCard",
      filter: null,
      to: "/app/system/users",
    },
  ];
}
