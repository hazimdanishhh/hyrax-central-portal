import {
  CaretCircleRightIcon,
  HandshakeIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import Breadcrumbs from "../../../../../../../../components/breadcrumbs/Breadcrumbs";
import Button from "../../../../../../../../components/buttons/button/Button";
import CardLayout from "../../../../../../../../components/cardLayout/CardLayout";
import NoResult from "../../../../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../../../../components/crud/pageHeader/PageHeader";
import LoadingIcon from "../../../../../../../../components/loadingIcon/LoadingIcon";
import LeadsList from "../../../../../../../../components/sales/leads/leadsList/LeadsList";
import { useEmployee } from "../../../../../../../../context/EmployeeContext";
import { useSidebar } from "../../../../../../../../context/SidebarContext"; // <-- IMPORT CONTEXT
import { useContacts } from "../../../../../../../../features/sales/contacts/private/hooks/useContacts";
import useLeadMutations from "../../../../../../../../features/sales/leads/private/hooks/useLeadMutations";
import { useLeads } from "../../../../../../../../features/sales/leads/private/hooks/useLeads";
import { useLeadsMetadata } from "../../../../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import { leadTableConfig } from "./constants/leadTableConfig";

function ClientLeadsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clientId } = useParams();
  const { employee } = useEmployee();

  // GLOBAL SIDEBAR
  const { openSidebar, closeSidebar } = useSidebar();

  const {
    data: leads,
    isLoading: leadsLoading,
    error: leadsError,
  } = useLeads(clientId);
  const { owners, clients, leadSourceTypes } = useLeadsMetadata();
  const { data: contacts } = useContacts(clientId);
  const { createLead, creating: creatingLead } = useLeadMutations();

  const leadColumns = leadTableConfig({
    employee,
    owners,
    contacts,
    leadSourceTypes,
  });

  // ==============
  // HANDLE ADD (VIA GLOBAL SIDEBAR)
  // ==============
  const handleOpenAddSidebar = () => {
    openSidebar({
      title: "Add Lead",
      icon: HandshakeIcon,
      rowData: { client_id: clientId }, // Pre-fill the client ID!
      columns: leadColumns,
      isEditing: true,
      creating: true,
      saving: creatingLead,

      onSave: async (formData) => {
        // 1. Create the lead
        await createLead({
          ...formData,
          client_id: clientId,
        });

        // 2. Invalidate caches so the tab updates instantly
        await queryClient.invalidateQueries({ queryKey: ["sales_leads"] }); // Main list
        await queryClient.invalidateQueries({
          queryKey: ["sales_leads", clientId],
        }); // If you have a specific key for this tab

        // 3. Close the global sidebar
        closeSidebar();
      },
    });
  };

  return (
    <CardLayout style="generalCard cardPaddingSmall">
      <PageHeader>
        <Breadcrumbs icon={HandshakeIcon} current="Latest Leads" />
        <div style={{ display: "flex", gap: "8px" }}>
          {/* ADD BUTTON */}
          <Button
            icon={PlusIcon}
            name="Add"
            style="button buttonType5 approval textXXS"
            size={16}
            onClick={handleOpenAddSidebar} // <-- TRIGGER GLOBAL SIDEBAR
          />
          {/* VIEW ALL BUTTON */}
          <Button
            icon={CaretCircleRightIcon}
            name="View All"
            style="button buttonType5 textXXS"
            size={20}
            onClick={() => navigate(`/app/sales/leads/list?client=${clientId}`)}
          />
        </div>
      </PageHeader>

      <CardLayout style="cardWrapperScroll generalCard">
        {leadsLoading ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : leadsError ? (
          <NoResult title="Error loading results" />
        ) : leads?.length === 0 ? (
          <NoResult />
        ) : (
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {leads?.map((lead) => (
              <LeadsList
                key={lead.id}
                lead={lead}
                // Redirects to main module and pops open the sidebar automatically
                onClick={() => navigate(`/app/sales/leads/list/${lead.id}`)}
                onEdit={() => navigate(`/app/sales/leads/list/${lead.id}`)}
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>
    </CardLayout>
  );
}

export default ClientLeadsTab;
