import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import Button from "../../buttons/button/Button";
import "./HelpSearchBar.scss";

// Deliberately not a reuse of SearchFilterBar.jsx -- that component carries
// filter-panel/export/date-range baggage this page doesn't need. This is
// instant (no Enter-key gate, no debounce): there's no network round-trip
// per keystroke to protect against, just an in-memory array filter.
export default function HelpSearchBar({ value, onChange, placeholder }) {
  return (
    <div className="helpSearchBarWrapper">
      <MagnifyingGlassIcon size={18} />
      <input
        type="text"
        value={value}
        placeholder={placeholder || "Search..."}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.length > 0 && (
        <Button
          onClick={() => onChange("")}
          icon={XIcon}
          size={16}
          style="iconButton2"
        />
      )}
    </div>
  );
}
