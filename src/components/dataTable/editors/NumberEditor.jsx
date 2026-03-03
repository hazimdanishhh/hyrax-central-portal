import { CopyIcon } from "@phosphor-icons/react";
import { useMessage } from "../../../context/MessageContext";
import Button from "../../buttons/button/Button";

export default function NumberEditor({ value, onChange, onBlur }) {
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
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {value && (
        <Button
          onClick={handleCopy}
          icon={CopyIcon}
          style="button iconButton2"
          size={16}
        />
      )}
    </div>
  );
}
