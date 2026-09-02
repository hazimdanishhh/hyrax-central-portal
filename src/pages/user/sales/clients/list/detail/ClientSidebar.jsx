import {
  CaretCircleRightIcon,
  HandshakeIcon,
  PencilSimpleLineIcon,
  PencilSimpleSlashIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import Button from "../../../../../../components/buttons/button/Button";
import "./ClientSidebar.scss";
import StatusBox from "../../../../../../components/status/statusBox/StatusBox";
import LoadingIcon from "../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../components/crud/noResult/NoResult";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import { useState } from "react";
import Breadcrumbs from "../../../../../../components/breadcrumbs/Breadcrumbs";
import PageHeader from "../../../../../../components/crud/pageHeader/PageHeader";
import { useNavigate } from "react-router";
import DataForm from "../../../../../../components/crud/dataForm/DataForm";
import { useLeads } from "../../../../../../features/sales/leads/private/hooks/useLeads";
import useLeadMutations from "../../../../../../features/sales/leads/private/hooks/useLeadMutations";
import { useLeadsMetadata } from "../../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import { useEmployee } from "../../../../../../context/EmployeeContext";
import LeadsList from "../../../../../../components/sales/leads/leadsList/LeadsList";
import { leadTableConfig } from "./constants/leadTableConfig";

export default function ClientSidebar({
  selectedRow,
  onRequestAction,
  updating,
  isEditing,
  setIsEditing,
}) {
  const navigate = useNavigate();
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const { employee } = useEmployee();

  // Clients are prospect-only (2026-08): the SAP link moved onto
  // sales_leads.sap_customer_code directly, so a lead referencing an
  // existing SAP customer never needs a clients proxy row at all. A
  // clients row's only purpose now is tracking a lead for a company with
  // no SAP relationship yet -- see
  // hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.4 for the full
  // decision this implements.

  // ==============
  // LEADS
  // ==============
  const {
    data: leads,
    isLoading: leadsLoading,
    error: leadsError,
  } = useLeads(selectedRow?.id);
  const {
    owners,
    leadSourceTypes,
    isLoading: leadsMetadataLoading,
    isFetching: leadsMetadataFetching,
    error: leadsMetadataError,
  } = useLeadsMetadata(); // Metadata
  const { createLead, creating: creatingLead } = useLeadMutations(); // Mutations
  const leadColumns = leadTableConfig({
    employee,
    owners,
    leadSourceTypes,
  }); // Table Config
  // Add Handler
  const handleAddLead = async (formData) => {
    await createLead({
      ...formData,
      client_id: selectedRow.id,
    });

    setIsAddingLead(false);
  };

  return (
    <div className="clientSidebarContainer">
      {/* --- CLIENT DETAILS SECTION --- */}
      <CardLayout style="cardLayout1 generalCard clientSidebarLeft">
        {!isEditing ? (
          <Button
            name="Edit"
            icon={PencilSimpleLineIcon}
            style="button buttonType4 textXS"
            size={16}
            onClick={() => setIsEditing(!isEditing)}
          />
        ) : (
          <Button
            name="Cancel Edit"
            icon={PencilSimpleSlashIcon}
            onClick={() => setIsEditing(!isEditing)}
            style="button buttonType4 textXS"
            size={16}
          />
        )}
        <p className="textBold">{selectedRow.name}</p>

        <div className="clientSidebarDetailsContainer">
          <StatusBox status="Prospect — not yet an SAP customer" type="grey" />
          {selectedRow.industry_id && (
            <StatusBox status={selectedRow.industry?.name} type="blue" />
          )}
        </div>
        <div className="generalCard cardPaddingSmall">
          <span className="textBold textXS">Address: </span>
          <p className="textRegular textXS">{selectedRow.address}</p>
        </div>
      </CardLayout>

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
            onClick={() =>
              navigate(`/app/sales/leads/list?client=${selectedRow.id}`)
            }
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

        <CardLayout style="cardWrapperScroll">
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
                  onClick={() => navigate(`/app/sales/leads/list/${lead.id}`)}
                  setIsEditing={() => setIsEditingLead(true)}
                />
              ))}
            </CardLayout>
          )}
        </CardLayout>
      </CardLayout>
    </div>
  );
}
