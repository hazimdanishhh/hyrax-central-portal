import {
  CaretCircleRightIcon,
  PencilSimpleIcon,
  PlusIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import Breadcrumbs from "../../../../../../../../components/breadcrumbs/Breadcrumbs";
import Button from "../../../../../../../../components/buttons/button/Button";
import CardLayout from "../../../../../../../../components/cardLayout/CardLayout";
import NoResult from "../../../../../../../../components/crud/noResult/NoResult";
import PageHeader from "../../../../../../../../components/crud/pageHeader/PageHeader";
import LoadingIcon from "../../../../../../../../components/loadingIcon/LoadingIcon";
import ContactsList from "../../../../../../../../components/sales/contacts/contactsList/ContactsList";
import { useModal } from "../../../../../../../../context/ActionModalContext";
import { useSidebar } from "../../../../../../../../context/SidebarContext";
import useContactMutations from "../../../../../../../../features/sales/contacts/private/hooks/useContactMutations";
import { useContacts } from "../../../../../../../../features/sales/contacts/private/hooks/useContacts";
import { contactTableConfig } from "./constants/contactTableConfig";

function ClientContactsTab() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const queryClient = useQueryClient();
  const { openSidebar, closeSidebar } = useSidebar();
  const { openModal } = useModal();

  // FETCH
  const {
    data: contacts,
    isLoading: contactsLoading,
    error: contactsError,
  } = useContacts(clientId);

  // MUTATIONS
  const { createContact, updateContact, deleteContact } = useContactMutations();

  // TABLE CONFIG
  const contactColumns = contactTableConfig();

  // ==============
  // HANDLE SAVE (CREATE & UPDATE)
  // ==============
  const handleRequestSave = async (formData) => {
    if (formData.id) {
      await updateContact(formData);
    } else {
      await createContact({
        ...formData,
        client_id: clientId, // Ensure it links to this client
      });
    }

    // Refresh the contacts list for this client
    await queryClient.invalidateQueries({
      queryKey: ["client_contacts", clientId],
    });

    // Close the global sidebar
    closeSidebar();
  };

  // ==============
  // HANDLE ADD (Opens Sidebar)
  // ==============
  const handleOpenAddSidebar = () => {
    openSidebar({
      title: "Add Contact",
      icon: UsersIcon,
      rowData: { client_id: clientId },
      columns: contactColumns,
      isEditing: true,
      creating: true,
      onSave: handleRequestSave,
    });
  };

  // ==============
  // HANDLE EDIT (Opens Sidebar)
  // ==============
  const handleOpenEditSidebar = (contact) => {
    openSidebar({
      title: "Edit Contact",
      icon: PencilSimpleIcon,
      rowData: contact,
      columns: contactColumns,
      isEditing: true,
      creating: false,
      onSave: handleRequestSave,
      onCancel: closeSidebar,
    });
  };

  // ==============
  // HANDLE DELETE (Opens Modal)
  // ==============
  const handleRequestDelete = (contact) => {
    openModal({
      title: "Delete Contact",
      description: `Are you sure you want to delete ${contact.full_name}?`,
      confirmText: "Delete",
      modalType: "delete",
      onConfirm: async () => {
        await deleteContact(contact.id);
        await queryClient.invalidateQueries({
          queryKey: ["client_contacts", clientId],
        });
      },
    });
  };

  return (
    <CardLayout style="generalCard cardPaddingSmall">
      <PageHeader>
        <Breadcrumbs icon={UsersIcon} current="Contacts" />

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
            onClick={() =>
              navigate(`/app/sales/clients/contacts?client=${clientId}`)
            }
          />
        </div>
      </PageHeader>

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
              <ContactsList
                key={contact.id}
                contact={contact}
                onEdit={() => handleOpenEditSidebar(contact)}
                onDelete={() => handleRequestDelete(contact)}
              />
            ))}
          </CardLayout>
        )}
      </CardLayout>
    </CardLayout>
  );
}

export default ClientContactsTab;
