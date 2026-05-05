import { useRef } from "react";
import Button from "../../buttons/button/Button";
import { CameraIcon } from "@phosphor-icons/react";
import CardLayout from "../../cardLayout/CardLayout";

export default function ImageUploadEditor({ value, onChange, readOnly, show }) {
  const inputRef = useRef();

  const preview = value instanceof File ? URL.createObjectURL(value) : value;

  return (
    <CardLayout style="cardLayout1">
      {preview && (
        <img
          src={preview}
          alt="preview"
          style={{
            width: "100%",
            aspectRatio: "1/1",
            objectFit: "cover",
            borderRadius: 12,
            border: "1px solid grey",
          }}
        />
      )}

      {!readOnly && !preview && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="user"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(file);
            }}
          />

          <Button
            name="Take Photo"
            icon2={CameraIcon}
            style="button buttonType2"
            type="button"
            onClick={() => inputRef.current.click()}
          />
        </>
      )}
    </CardLayout>
  );
}
