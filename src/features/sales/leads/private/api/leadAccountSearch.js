import { searchSapCustomersForLinking } from "../../../clients/private/api/sapCustomerSearch";
import { searchClients } from "../../../clients/private/api/clientSearch";

// Unified account picker for a Lead (2026-08): a lead references exactly
// one of a real SAP customer or a native "Prospect" client, never a local
// clients row mirroring an SAP customer -- see
// hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.4 for the full decision.
// Runs both searches in parallel and returns react-select's grouped-options
// shape, so a salesperson never has to know upfront which table a company
// lives in. When there's a search term, appends a "+ Create new prospect"
// pseudo-option to the Prospects group -- LeadAccountEditor.jsx intercepts
// selecting it (via the __create flag) instead of setting the field
// directly, so a brand-new prospect can be created without leaving the
// Lead form.
export async function searchLeadAccounts(search = "") {
  const [sapCustomers, prospects] = await Promise.all([
    searchSapCustomersForLinking(search),
    searchClients(search),
  ]);

  const prospectOptions = prospects.map((option) => ({
    ...option,
    __type: "prospect",
  }));

  if (search?.trim()) {
    prospectOptions.push({
      __create: true,
      __type: "prospect",
      value: `__create__${search}`,
      label: `+ Create new prospect "${search}"`,
      searchTerm: search,
    });
  }

  return [
    {
      label: "SAP Customers",
      options: sapCustomers.map((option) => ({ ...option, __type: "sap" })),
    },
    {
      label: "Prospects",
      options: prospectOptions,
    },
  ];
}
