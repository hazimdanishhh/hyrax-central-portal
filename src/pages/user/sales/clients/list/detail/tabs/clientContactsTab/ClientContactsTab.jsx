import React, { useState } from "react";
import { useContacts } from "../../../../../../../../features/sales/contacts/private/hooks/useContacts";
import { useParams } from "react-router";
import useContactMutations from "../../../../../../../../features/sales/contacts/private/hooks/useContactMutations";
import { contactTableConfig } from "./constants/contactTableConfig";
import CardLayout from "../../../../../../../../components/cardLayout/CardLayout";
import PageHeader from "../../../../../../../../components/crud/pageHeader/PageHeader";
import Breadcrumbs from "../../../../../../../../components/breadcrumbs/Breadcrumbs";
import { PlusIcon, UsersIcon } from "@phosphor-icons/react";
import Button from "../../../../../../../../components/buttons/button/Button";
import DataForm from "../../../../../../../../components/crud/dataForm/DataForm";
import LoadingIcon from "../../../../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../../../../components/crud/noResult/NoResult";
import ContactsList from "../../../../../../../../components/sales/contacts/contactsList/ContactsList";

function ClientContactsTab() {
  const { clientId } = useParams();
  const [isAddingContact, setIsAddingContact] = useState(false);

  // FETCH
  const {
    data: contacts,
    isLoading: contactsLoading,
    error: contactsError,
  } = useContacts(clientId);

  // MUTATIONS
  const { createContact, creating: creatingContact } = useContactMutations();

  // TABLE CONFIG
  const contactColumns = contactTableConfig();

  // ADD HANDLER
  const handleAddContact = async (formData) => {
    await createContact({
      ...formData,
      client_id: clientId,
    });

    setIsAddingContact(false);
  };

  return (
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
  );
}

export default ClientContactsTab;
