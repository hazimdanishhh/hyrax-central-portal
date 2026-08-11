// react-select's formatOptionLabel: (option, { context }) => ReactNode.
// context is "menu" (dropdown open, one row per option) or "value" (the
// closed control's selected chip). Supersedes the Clients-side
// sapCustomerOptionLabel.jsx (the SAP link moved onto Leads, 2026-08) --
// same code/city/contact/phone disambiguation for the SAP group, plus the
// Prospects group and the "+ Create new prospect" pseudo-option.
export function formatLeadAccountOption(option, { context }) {
  if (option.__create) {
    return <p className="textRegular textXS textLink">{option.label}</p>;
  }

  if (context === "value") {
    return (
      <span title={option.__type === "sap" ? option.value : undefined}>
        {option.label}
      </span>
    );
  }

  if (option.__type === "sap") {
    const detail = [option.city, option.contactPerson, option.phone]
      .filter(Boolean)
      .join(" · ");

    return (
      <div>
        <p className="textRegular textXS">
          {option.value} — {option.label}
        </p>
        {detail && <p className="textXS textLight">{detail}</p>}
      </div>
    );
  }

  return <p className="textRegular textXS">{option.label}</p>;
}
