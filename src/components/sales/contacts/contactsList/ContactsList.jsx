import {
  EnvelopeSimpleIcon,
  PencilSimpleIcon,
  PhoneIcon,
  TrashSimpleIcon,
} from "@phosphor-icons/react";
import StatusBox from "../../../status/statusBox/StatusBox";
import "./ContactsList.scss";
import IconCard from "../../../iconCard/IconCard";
import { Link } from "react-router";
import Button from "../../../buttons/button/Button";
import { useState } from "react";
import useContactMutations from "../../../../features/sales/contacts/private/hooks/useContactMutations";
import DataForm from "../../../crud/dataForm/DataForm";
import { getTableConfig } from "../../clients/clientSidebar/constants/tableConfig";
import { useMessage } from "../../../../context/MessageContext";
import ActionModal from "../../../modals/actionModal/ActionModal";
import { getActionConfig } from "./constants/actionConfig";
import { useQueryClient } from "@tanstack/react-query";

export default function ContactsList({ contact }) {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();
  const [isEditing, setIsEditing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // "save" | "reject"
  const [pendingSaveRow, setPendingSaveRow] = useState(null);

  // ==============
  //   MUTATION HOOK
  // ==============
  const { deleteContact, updateContact, deleting, updating } =
    useContactMutations();

  // ==============
  // CONFIG
  // ==============
  const contactColumns = getTableConfig();
  const modalConfig = getActionConfig[modalType] || {};

  // ==============
  // SAVE + UPDATE
  // ==============
  function handleRequestSave(data) {
    setPendingSaveRow({
      id: contact.id,
      client_id: contact.client_id,
      ...data,
    });
    setModalType("save");
    setModalOpen(true);
  }

  // ==============
  // DELETE
  // ==============
  function handleRequestDelete() {
    setModalType("delete");
    setModalOpen(true);
  }

  // ==============
  // CONFIRM ACTION DELETE / SAVE / UPDATE
  // ==============
  async function handleConfirmAction() {
    try {
      // DELETE
      if (modalType === "delete") {
        await deleteContact(contact.id);
      }

      // SAVE
      if (modalType === "save") {
        await updateContact(pendingSaveRow);

        setIsEditing(false);
      }

      await queryClient.invalidateQueries({
        queryKey: ["client_contacts", contact.client_id],
      });

      // RESET
      setModalOpen(false);
      setPendingSaveRow(null);
      setModalType(null);
    } catch (err) {
      console.error(err);
    }
  }

  // =========================
  // HANDLE COPY
  // =========================
  const handleCopy = async (value) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      showMessage("Copied to Clipboard", "success");
    } catch (err) {
      console.error("Failed to copy:", err);
      showMessage(`Failed to copy: ${err}`, "error");
    }
  };

  return (
    <>
      {isEditing ? (
        <DataForm
          columns={contactColumns}
          rowData={contact}
          onSave={handleRequestSave}
          onDelete={handleRequestDelete}
          onCancel={() => setIsEditing(false)}
          saving={updating}
          deleting={deleting}
          inlineForm
        />
      ) : (
        <Link
          className="contactListContainer generalCard cardPaddingSmall"
          to={`/app/sales/clients/contacts/${contact.id}`}
        >
          <div className="contactList">
            <div className="contactListHeader">
              <p className="textBold textXS">{contact.full_name}</p>
              {contact.position && (
                <StatusBox status={contact.position} type="blue" />
              )}
            </div>

            <div className="contactListActionContainer">
              {contact.email && (
                <Button
                  icon2={EnvelopeSimpleIcon}
                  style="iconButton2 textRegular textXXS"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopy(contact.email);
                  }}
                  size={16}
                  title={contact.email}
                />
              )}

              {contact.phone && (
                <Button
                  icon2={PhoneIcon}
                  style="iconButton2 textRegular textXXS"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopy(contact.phone);
                  }}
                  size={16}
                  title={contact.phone}
                />
              )}

              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                icon={PencilSimpleIcon}
                size={16}
                style="iconButton2"
              />

              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRequestDelete();
                }}
                icon={TrashSimpleIcon}
                size={16}
                style="iconButton2 rejection textXXS"
              />
            </div>
          </div>
        </Link>
      )}

      <ActionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText={modalConfig.confirmText}
        loading={updating || deleting}
        onConfirm={handleConfirmAction}
        modalType={modalConfig.modalType}
      />
    </>
  );
}
