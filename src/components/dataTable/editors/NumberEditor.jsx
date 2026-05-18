import { CopyIcon } from "@phosphor-icons/react";
import { useMessage } from "../../../context/MessageContext";
import Button from "../../buttons/button/Button";

export default function NumberEditor({
  value,
  onChange,
  onBlur,
  required,
  readOnly,
  min,
  max,
  step = 1,
}) {
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
        required={required}
        readOnly={readOnly}
        min={min}
        max={max}
        step={step}
      />
      {value && (
        <Button
          onClick={handleCopy}
          icon={CopyIcon}
          style="iconButton2"
          size={16}
          type="button"
        />
      )}
    </div>
  );
}
