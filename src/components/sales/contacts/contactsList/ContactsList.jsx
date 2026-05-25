import {
  EnvelopeSimpleIcon,
  PencilSimpleIcon,
  PhoneIcon,
  TrashSimpleIcon,
} from "@phosphor-icons/react";
import { Link } from "react-router";
import { useMessage } from "../../../../context/MessageContext";
import Button from "../../../buttons/button/Button";
import StatusBox from "../../../status/statusBox/StatusBox";
import "./ContactsList.scss";

export default function ContactsList({ contact, onEdit, onDelete }) {
  const { showMessage } = useMessage();

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
              onEdit(); // Trigger the parent's handler
            }}
            icon={PencilSimpleIcon}
            size={16}
            style="iconButton2"
          />

          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(); // Trigger the parent's handler
            }}
            icon={TrashSimpleIcon}
            size={16}
            style="iconButton2 rejection textXXS"
          />
        </div>
      </div>
    </Link>
  );
}
