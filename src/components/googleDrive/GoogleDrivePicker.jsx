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
  // Restricts the picker to folders/Shared Drives only, for a "link to
  // this folder" field (e.g. a project's drive_folder_url) rather than a
  // file attachment. The underlying library (react-google-drive-picker)
  // always adds its own generic DocsView(ViewId.DOCS) alongside any
  // customViews UNLESS disableDefaultView is set -- that default view is
  // exactly what let files still be picked even though the custom view
  // below already had setIncludeFolders(true), so folder-only mode has to
  // suppress it and rely solely on a ViewId.FOLDERS custom view.
  selectFolders = false,
}) {
  const { session } = useAuth();
  const [openPicker] = useDrivePicker();

  const handleOpenPicker = () => {
    let customViews = undefined;

    if (window.google) {
      customViews = selectFolders
        ? [
            new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
              .setIncludeFolders(true)
              .setSelectFolderEnabled(true) // lets the currently-open folder itself be picked, not just navigated into
              .setEnableDrives(true),
          ]
        : [
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
      disableDefaultView: selectFolders,
      setIncludeFolders: true,
      supportDrives: true,

      customScopes: ["https://www.googleapis.com/auth/drive.file"],
      showUploadView: !selectFolders,
      showUploadFolders: !selectFolders,
      multiselect: multiple,
      callbackFunction: (data) => {
        if (data.action === "cancel") {
          console.log("User canceled the picker");
        }
        if (data.action === "picked") {
          // A Shared Drive selected directly (its root, not a subfolder
          // inside it) is a known Picker quirk: `id` comes back valid but
          // `url` sometimes comes back empty. Folders never hit this, but
          // fall back to the standard "open this Drive folder" URL shape
          // regardless, keyed off `id`, so a Shared Drive pick still
          // resolves to a working link.
          const resolveUrl = (file) =>
            file.url ||
            (selectFolders && file.id
              ? `https://drive.google.com/drive/folders/${file.id}`
              : file.url);

          if (multiple) {
            onSelect(
              data.docs.map((file) => ({
                name: file.name,
                url: resolveUrl(file),
                id: file.id,
                mimeType: file.mimeType,
                iconUrl: file.iconUrl,
              })),
            );
          } else {
            const file = data.docs[0];
            onSelect({
              name: file.name,
              url: resolveUrl(file),
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
