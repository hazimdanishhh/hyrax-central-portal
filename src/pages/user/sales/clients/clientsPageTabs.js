// src/pages/user/sales/clients/clientsPageTabs.js
//
// Single source of truth for the Clients page-tab bar (ClientsPageLayout.jsx)
// and its nested sidenav sub-links (the "Clients" link's `tabs` field in
// src/data/sideNavLinkData.js). Both tabs share the parent link's own gate
// (departments: ["SAL","MGM"]), matching prospects/sap's AccessRoute in
// SalesRoutes.jsx exactly, so neither needs its own roles/departments here.
import { ListIcon, DatabaseIcon } from "@phosphor-icons/react";

export const clientsPageTabs = [
  { label: "Prospects", icon: ListIcon, path: "prospects" },
  { label: "SAP Clients", icon: DatabaseIcon, path: "sap" },
];
