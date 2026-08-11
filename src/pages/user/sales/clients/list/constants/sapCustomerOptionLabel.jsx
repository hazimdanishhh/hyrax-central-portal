// react-select's formatOptionLabel: (option, { context }) => ReactNode.
// context is "menu" (dropdown open, one row per option) or "value" (the
// closed control's selected chip). Full disambiguating detail only in the
// menu -- the closed control stays a plain name so the field doesn't look
// cluttered once something's picked; the code is still visible on hover via
// the title attribute for a quick sanity check.
export function formatSapCustomerOption(option, { context }) {
  if (context === "value") {
    return <span title={option.value}>{option.label}</span>;
  }

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
