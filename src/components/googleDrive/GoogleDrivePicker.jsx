import React from "react";
import useDrivePicker from "react-google-drive-picker";
import { GoogleLogoIcon } from "@phosphor-icons/react";
import "./GoogleDrivePicker.scss";
import { useAuth } from "../../context/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY;
const GOOGLE_APP_ID = import.meta.env.VITE_GOOGLE_APP_ID;

export default function GoogleDrivePicker({
  onSelect,
  label = "Select from Drive",
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

      customScopes: ["https://www.googleapis.com/auth/drive.readonly"],
      showUploadView: true,
      showUploadFolders: true,
      multiselect: false,
      callbackFunction: (data) => {
        if (data.action === "cancel") {
          console.log("User canceled the picker");
        }
        if (data.action === "picked") {
          const file = data.docs[0];
          onSelect({
            name: file.name,
            url: file.url,
            id: file.id,
          });
        }
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleOpenPicker}
      className="button buttonType5 textXS"
    >
      <GoogleLogoIcon size={16} />
      {label}
    </button>
  );
}
