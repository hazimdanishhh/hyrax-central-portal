// src/pages/user/it/ITAssetManagement/itAssetsPageTabs.js
//
// Single source of truth for the IT Assets page-tab bar
// (ITAssetsPageLayout.jsx) and its nested sidenav sub-links (the "IT
// Assets" link's `tabs` field in src/data/sideNavLinkData.js). Both tabs
// share the parent link's own gate (departments: ["IT"]), matching
// overview/list's AccessRoute in ITRoutes.jsx exactly.
import { ChartLineIcon, ListIcon } from "@phosphor-icons/react";

export const itAssetsPageTabs = [
  { label: "Overview", icon: ChartLineIcon, path: "overview" },
  { label: "Asset List", icon: ListIcon, path: "list" },
];
