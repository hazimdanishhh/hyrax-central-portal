import React, { forwardRef } from "react";
import GoogleDrivePicker from "../../googleDrive/GoogleDrivePicker";

const GoogleDriveEditor = forwardRef(
  ({ value, onChange, placeholder, readOnly, ...props }, ref) => {
    return (
      <div className="editorContainer">
        <input
          ref={ref}
          type="text"
          className=""
          value={value || ""}
          readOnly={true} // Always readonly so users don't type random text
          placeholder={placeholder || "No document selected..."}
          {...props}
        />

        {/* Only show the picker button if the field is editable */}
        {!readOnly && (
          <GoogleDrivePicker
            label="Browse Drive"
            onSelect={(file) => {
              // file.url comes from the picker, pass it to React Hook Form
              onChange(file.url);
            }}
          />
        )}
      </div>
    );
  },
);

GoogleDriveEditor.displayName = "GoogleDriveEditor";
export default GoogleDriveEditor;
