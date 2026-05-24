import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useLeads } from "../../../../../../../../features/sales/leads/private/hooks/useLeads";
import { useLeadsMetadata } from "../../../../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import useLeadMutations from "../../../../../../../../features/sales/leads/private/hooks/useLeadMutations";
import { leadTableConfig } from "./constants/leadTableConfig";
import PageHeader from "../../../../../../../../components/crud/pageHeader/PageHeader";
import CardLayout from "../../../../../../../../components/cardLayout/CardLayout";
import Breadcrumbs from "../../../../../../../../components/breadcrumbs/Breadcrumbs";
import {
  CaretCircleRightIcon,
  HandshakeIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import Button from "../../../../../../../../components/buttons/button/Button";
import DataForm from "../../../../../../../../components/crud/dataForm/DataForm";
import LoadingIcon from "../../../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../../../components/crud/noResult/NoResult";
import LeadsList from "../../../../../../../../components/sales/leads/leadsList/LeadsList";
import { useEmployee } from "../../../../../../../../context/EmployeeContext";
import { useContacts } from "../../../../../../../../features/sales/contacts/private/hooks/useContacts";

function ClientLeadsTab() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const { employee } = useEmployee();

  const {
    data: leads,
    isLoading: leadsLoading,
    error: leadsError,
  } = useLeads(clientId);
  const {
    owners,
    clients,
    clientContacts,
    leadSourceTypes,
    isLoading: leadsMetadataLoading,
    isFetching: leadsMetadataFetching,
    error: leadsMetadataError,
  } = useLeadsMetadata(); // Metadata
  const { createLead, creating: creatingLead } = useLeadMutations(); // Mutations

  const {
    data: contacts,
    isLoading: contactsLoading,
    error: contactsError,
  } = useContacts(clientId); // Fetch
  const leadColumns = leadTableConfig({
    employee,
    owners,
    contacts,
    leadSourceTypes,
  }); // Table Config
  // Add Handler
  const handleAddLead = async (formData) => {
    await createLead({
      ...formData,
      client_id: clientId,
    });

    setIsAddingLead(false);
  };

  return (
    <CardLayout style="generalCard cardPaddingSmall">
      <PageHeader>
        <Breadcrumbs icon={HandshakeIcon} current="Latest Leads" />
        {/* ADD BUTTON */}
        <Button
          icon={PlusIcon}
          name="Add Lead"
          style="button buttonType5 approval textXS"
          size={16}
          onClick={() => setIsAddingLead(true)}
          disabled={isAddingLead}
        />
        {/* VIEW ALL BUTTON */}
        <Button
          icon={CaretCircleRightIcon}
          name="View All"
          style="button buttonType5 textXS"
          size={16}
          onClick={() => navigate(`/app/sales/leads/list?client=${clientId}`)}
          disabled={isAddingLead}
        />
      </PageHeader>

      {/* INLINE ADD FORM */}
      {isAddingLead && (
        <DataForm
          columns={leadColumns}
          rowData={{}}
          onSave={handleAddLead}
          onCancel={() => setIsAddingLead(false)}
          saving={creatingLead}
          creating
          inlineForm
          title="Add Lead"
        />
      )}

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
            {/* CONTACTS LIST */}
            {leads?.map((lead) => (
              <LeadsList
                key={lead.id}
                lead={lead}
                onClick={() => navigate(`/app/sales/leads/list/${lead.id}`)}
                setIsEditing={() => setIsEditingLead(true)}
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>
    </CardLayout>
  );
}

export default ClientLeadsTab;
