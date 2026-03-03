import { ArrowLineUpRightIcon, CopyIcon } from "@phosphor-icons/react";
import LinkButton from "../../buttons/linkButton/LinkButton";
import "./LinkEditor.scss";
import Button from "../../buttons/button/Button";

export default function LinkEditor({ value, onChange, onBlur }) {
  const handleCopy = async () => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      console.log("Copied to clipboard:", value);
      // Optional: trigger message/toast here
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="linkEditorContainer">
      <input
        type="url"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <LinkButton
        href={value ?? ""}
        icon={ArrowLineUpRightIcon}
        style="button iconButton2"
        size={16}
      />
      <Button
        onClick={handleCopy}
        icon={CopyIcon}
        style="button iconButton2"
        size={16}
      />
    </div>
  );
}
