import { ArrowLineUpRightIcon, CopyIcon } from "@phosphor-icons/react";
import LinkButton from "../../buttons/linkButton/LinkButton";
import Button from "../../buttons/button/Button";
import { useMessage } from "../../../context/MessageContext";

export default function LinkEditor({ value, onChange, onBlur, required }) {
  const { showMessage } = useMessage();

  const handleCopy = async () => {
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
    <div className="editorContainer">
      <input
        type="url"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
      />
      {value && (
        <>
          <LinkButton
            href={value}
            icon={ArrowLineUpRightIcon}
            style="iconButton2"
            size={16}
          />
          <Button
            onClick={handleCopy}
            icon={CopyIcon}
            style="iconButton2"
            size={16}
            type="button"
          />
        </>
      )}
    </div>
  );
}
