import React from "react";
import useDrivePicker from "react-google-drive-picker";
import { GoogleLogoIcon, PlusCircleIcon } from "@phosphor-icons/react";
import "./GoogleDrivePicker.scss";
import { useAuth } from "../../context/AuthContext";
import googleLogo from "/src/assets/icons/googledrive.svg";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY;
const GOOGLE_APP_ID = import.meta.env.VITE_GOOGLE_APP_ID;

export default function GoogleDrivePicker({
  onSelect,
  label = "Select from Drive",
  multiple = false,
}) {
  const { session } = useAuth();
  const [openPicker] = useDrivePicker();

  const handleOpenPicker = () => {
    let customViews = undefined;

    if (window.google) {
      customViews = [
        new window.google.picker.DocsView()
          .setIncludeFolders(true)
          .setEnableDrives(true),
      ];
    }

    openPicker({
      clientId: GOOGLE_CLIENT_ID,
      developerKey: GOOGLE_API_KEY,
      appId: GOOGLE_APP_ID,
      token: session?.provider_token,

      customViews: customViews,
      setIncludeFolders: true,
      supportDrives: true,

      customScopes: ["https://www.googleapis.com/auth/drive.file"],
      showUploadView: true,
      showUploadFolders: true,
      multiselect: multiple,
      callbackFunction: (data) => {
        if (data.action === "cancel") {
          console.log("User canceled the picker");
        }
        if (data.action === "picked") {
          if (multiple) {
            onSelect(
              data.docs.map((file) => ({
                name: file.name,
                url: file.url,
                id: file.id,
                mimeType: file.mimeType,
                iconUrl: file.iconUrl,
              })),
            );
          } else {
            const file = data.docs[0];
            onSelect({
              name: file.name,
              url: file.url,
              id: file.id,
            });
          }
        }
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleOpenPicker}
      className="button buttonType5 approval textXS"
    >
      <img src={googleLogo} alt="Google" style={{ width: "16px" }} />
      {label}
      <PlusCircleIcon size={20} />
    </button>
  );
}
