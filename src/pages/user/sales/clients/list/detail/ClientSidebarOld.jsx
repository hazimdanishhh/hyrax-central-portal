import {
  CaretCircleRightIcon,
  HandshakeIcon,
  PencilSimpleLineIcon,
  PencilSimpleSlashIcon,
  PlusIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import Button from "../../../../../../components/buttons/button/Button";
import "./ClientDetail.scss";
import StatusBox from "../../../../../../components/status/statusBox/StatusBox";
import { useContacts } from "../../../../../../features/sales/contacts/private/hooks/useContacts";
import LoadingIcon from "../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../components/crud/noResult/NoResult";
import CardLayout from "../../../../../../components/cardLayout/CardLayout";
import ContactsList from "../../../../../../components/sales/contacts/contactsList/ContactsList";
import { useState } from "react";
import Breadcrumbs from "../../../../../../components/breadcrumbs/Breadcrumbs";
import PageHeader from "../../../../../../components/crud/pageHeader/PageHeader";
import { useNavigate, useParams } from "react-router";
import DataForm from "../../../../../../components/crud/dataForm/DataForm";
import useContactMutations from "../../../../../../features/sales/contacts/private/hooks/useContactMutations";
import { useLeads } from "../../../../../../features/sales/leads/private/hooks/useLeads";
import useLeadMutations from "../../../../../../features/sales/leads/private/hooks/useLeadMutations";
import { useLeadsMetadata } from "../../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import { useEmployee } from "../../../../../../context/EmployeeContext";
import LeadsList from "../../../../../../components/sales/leads/leadsList/LeadsList";
import { contactTableConfig } from "./tabs/clientContactsTab/constants/contactTableConfig";
import { leadTableConfig } from "./tabs/clientLeadsTab/constants/leadTableConfig";
import LeadsManagement from "./tabs/clientLeadsTab/ClientLeadsTab";
import CardWrapper from "../../../../../../components/cardWrapper/CardWrapper";
import { useClient } from "../../../../../../features/sales/clients/private/hooks/useClient";

export default function ClientDetail({
  onRequestAction,
  updating,
  isEditing,
  setIsEditing,
}) {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [tab, setTab] = useState("contacts");
  const { employee } = useEmployee();
  const {
    data: selectedRow,
    isLoading: clientLoading,
    error: clientError,
  } = useClient(clientId);

  // ==============
  // CONTACTS
  // ==============
  const {
    data: contacts,
    isLoading: contactsLoading,
    error: contactsError,
  } = useContacts(selectedRow?.id); // Fetch
  const { createContact, creating: creatingContact } = useContactMutations(); // Mutations
  const contactColumns = contactTableConfig(); // Table Config
  // Add Contact Handler
  const handleAddContact = async (formData) => {
    await createContact({
      ...formData,
      client_id: selectedRow.id,
    });

    setIsAddingContact(false);
  };

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
    clients,
    clientContacts,
    leadSourceTypes,
    isLoading: leadsMetadataLoading,
    isFetching: leadsMetadataFetching,
    error: leadsMetadataError,
  } = useLeadsMetadata(); // Metadata
  const { createLead, creating: creatingLead } = useLeadMutations(); // Mutations
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
      client_id: selectedRow.id,
    });

    setIsAddingLead(false);
  };

  if (clientLoading) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <LoadingIcon />
      </CardLayout>
    );
  }

  if (clientError || !selectedRow) {
    return <NoResult title="Client not found" />;
  }

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
          {selectedRow.sap_bp_id && (
            <StatusBox
              status={`SAP-BP-ID-${selectedRow.sap_bp_id}`}
              type="green"
            />
          )}
          {selectedRow.industry_id && (
            <StatusBox status={selectedRow.industry?.name} type="blue" />
          )}
        </div>
        <div className="generalCard cardPaddingSmall">
          <span className="textBold textXS">Address: </span>
          <p className="textRegular textXS">{selectedRow.address}</p>
        </div>
      </CardLayout>

      <CardLayout>
        {/* TABS */}
        <div className="pageTabContainer">
          <Button
            icon2={UsersIcon}
            onClick={() => setTab("contacts")}
            name="Contacts"
            style={`button buttonTypeTab ${tab === "contacts" && "active"}`}
          />
          <Button
            icon2={HandshakeIcon}
            onClick={() => setTab("leads")}
            name="Leads"
            style={`button buttonTypeTab ${tab === "leads" && "active"}`}
          />
          <Button
            onClick={() => {
              navigate(
                `/app/sales/clients/list/${selectedRow.id}?client=${selectedRow.id}`,
              );
              setTab("orders");
            }}
            name="Orders"
            style={`button buttonTypeTab ${tab === "orders" && "active"}`}
          />
        </div>

        {/* CONTACTS TAB */}
        {tab === "contacts" && (
          <CardLayout style="generalCard cardPaddingSmall">
            <PageHeader>
              <Breadcrumbs icon={UsersIcon} current="Contacts" />
              {/* ADD BUTTON */}
              <Button
                icon={PlusIcon}
                name="Add Contact"
                style="button buttonType5 approval textXS"
                size={16}
                onClick={() => setIsAddingContact(true)}
                disabled={isAddingContact}
              />
            </PageHeader>

            {/* INLINE ADD FORM */}
            {isAddingContact && (
              <DataForm
                columns={contactColumns}
                rowData={{}}
                onSave={handleAddContact}
                onCancel={() => setIsAddingContact(false)}
                saving={creatingContact}
                creating
                inlineForm
                title="Add Contact"
              />
            )}

            <CardLayout style="cardWrapperScroll generalCard">
              {contactsLoading ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : contactsError ? (
                <NoResult title="Error loading results" />
              ) : contacts?.length === 0 ? (
                <NoResult />
              ) : (
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {/* CONTACTS LIST */}
                  {contacts?.map((contact) => (
                    <ContactsList contact={contact} key={contact.id} />
                  ))}
                </CardLayout>
              )}
            </CardLayout>
          </CardLayout>
        )}

        {/* LEADS TAB */}
        {tab === "leads" && (
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
                      onClick={() =>
                        navigate(`/app/sales/leads/list/${lead.id}`)
                      }
                      setIsEditing={() => setIsEditingLead(true)}
                    />
                  ))}
                </CardLayout>
              )}
            </CardLayout>
          </CardLayout>
        )}

        {tab === "orders" && (
          <CardWrapper>
            <LeadsManagement />
          </CardWrapper>
        )}
      </CardLayout>
    </div>
  );
}
