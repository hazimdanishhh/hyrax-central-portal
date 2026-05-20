import {
  HandshakeIcon,
  PencilSimpleLineIcon,
  PencilSimpleSlashIcon,
  PlusIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import Button from "../../../buttons/button/Button";
import "./ClientSidebar.scss";
import StatusBox from "../../../status/statusBox/StatusBox";
import { useContacts } from "../../../../features/sales/contacts/private/hooks/useContacts";
import LoadingIcon from "../../../loadingIcon/LoadingIcon";
import NoResult from "../../../crud/noResult/NoResult";
import CardLayout from "../../../cardLayout/CardLayout";
import ContactsList from "../../contacts/contactsList/ContactsList";
import { useState } from "react";
import { getTableConfig } from "./constants/tableConfig";
import Breadcrumbs from "../../../breadcrumbs/Breadcrumbs";
import PageHeader from "../../../crud/pageHeader/PageHeader";
import { useNavigate } from "react-router";
import DataForm from "../../../crud/dataForm/DataForm";
import useContactMutations from "../../../../features/sales/contacts/private/hooks/useContactMutations";

export default function ClientSidebar({
  selectedRow,
  onRequestAction,
  updating,
  isEditing,
  setIsEditing,
}) {
  const navigate = useNavigate();
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [tab, setTab] = useState("contacts");

  // ==============
  // HOOKS
  // ==============
  const {
    data: contacts,
    isLoading: contactsLoading,
    error: contactsError,
  } = useContacts(selectedRow?.id);

  //   MUTATION HOOK
  const { createContact, creating } = useContactMutations();

  // ==============
  // CONFIG
  // ==============
  const contactColumns = getTableConfig();

  // ==============
  // HANDLE ADD
  // ==============
  const handleAddContact = async (formData) => {
    await createContact({
      ...formData,
      client_id: selectedRow.id,
    });

    setIsAddingContact(false);
  };

  return (
    <div className="clientSidebarContainer">
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

      {/* --- CLIENT DETAILS SECTION --- */}
      <CardLayout>
        <div className="clientSidebarDetailsContainer">
          {selectedRow.sap_bp_id && (
            <StatusBox status={`BP-${selectedRow.sap_bp_id}`} type="green" />
          )}
          <p className="textRegular textXS">{selectedRow.name}</p>
        </div>

        <div className="clientSidebarDetailsContainer">
          <StatusBox status={selectedRow.industry?.name} type="blue" />
        </div>
        <div className="generalCard cardPaddingSmall">
          <span className="textBold textXS">Address: </span>
          <p className="textRegular textXS">{selectedRow.address}</p>
        </div>
      </CardLayout>

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
          onClick={() => setTab("orders")}
          name="Orders"
          style={`button buttonTypeTab ${tab === "orders" && "active"}`}
        />
      </div>

      {/* --- CONTACT DETAILS SECTION --- */}
      {tab === "contacts" && (
        <CardLayout style="generalCard cardPaddingSmall">
          <PageHeader>
            <Breadcrumbs icon={UsersIcon} current="Contacts" />
            {/* ADD BUTTON */}
            <Button
              icon={PlusIcon}
              name="Add Contact"
              style="button buttonType5 textXS"
              size={16}
              onClick={() => setIsAddingContact(true)}
              disabled={isAddingContact}
            />
          </PageHeader>

          {/* INLINE ADD CONTACT FORM */}
          {isAddingContact && (
            <DataForm
              columns={contactColumns}
              rowData={{}}
              onSave={handleAddContact}
              onCancel={() => setIsAddingContact(false)}
              creating={true}
              saving={creating}
              inlineForm
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
    </div>
  );
}
