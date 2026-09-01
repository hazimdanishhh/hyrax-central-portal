import {
  CheckCircleIcon,
  DesktopIcon,
  UserMinusIcon,
  WarningIcon,
  ListChecksIcon,
} from "@phosphor-icons/react";

export function getAssetsOverviewConfig(kpis) {
  return [
    {
      label: "Total Assets",
      value: kpis.totalAssets,
      icon: DesktopIcon,
      filter: null,
    },
    // See docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's "Employee
    // Management & IT Asset Management integration" -- the only IT-side
    // surface for lifecycle cases (ITAssetManagement's own sidebar has no
    // per-employee view mode, and assets aren't 1:1 with employees, so
    // there's no natural per-row indicator to add there instead).
    // `openOnboardingCasesCount` is a pragmatic proxy for "awaiting IT
    // setup" -- virtually every open onboarding case still has at least
    // one IT-owned item pending until near its very end.
    {
      label: "Employees Awaiting IT Setup",
      value: kpis.openOnboardingCasesCount || 0,
      icon: ListChecksIcon,
      variant: kpis.openOnboardingCasesCount > 0 ? "yellowCard" : "greenCard",
      to: "/app/it/onboarding",
      filter: null,
    },
    {
      label: "Active Assets",
      value: kpis.activeAssets,
      icon: CheckCircleIcon,
      variant: "greenCard",
      filter: { status: 1 },
    },
    {
      label: "Risk Assets",
      value: kpis.riskAssets,
      icon: WarningIcon,
      variant: "redCard",
      filter: { condition: 3 },
    },
    {
      label: "Unassigned",
      value: kpis.unassignedAssets,
      icon: UserMinusIcon,
      variant: "yellowCard",
      filter: null,
    },
  ];
}
