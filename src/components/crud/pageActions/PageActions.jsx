import Button from "../../buttons/button/Button";
import CardLayout from "../../cardLayout/CardLayout";
import "./PageActions.scss";

export default function PageActions({
  layout,
  setLayout,
  options = [],
  actionButtons,
}) {
  // find current layout option
  const current = options.find((opt) => opt.value === layout);

  // find the "other" layout (toggle behavior)
  const next = options.find((opt) => opt.value !== layout);

  return (
    <CardLayout style="pageActionsContainer cardGapSmall cardLayoutNoPadding">
      {next && (
        <Button
          icon={next.icon}
          tooltipName={next.tooltipName}
          style="button buttonType5 textXXS"
          onClick={() => setLayout(next.value)}
          size={20}
        />
      )}

      {actionButtons.map((action, index) => (
        <Button
          key={index}
          name={action.name}
          icon2={action.icon}
          style={action.style || "button buttonType5 textXXS"}
          onClick={action.onClick}
          disabled={action.disabled}
          size={action.size || 20}
        />
      ))}
    </CardLayout>
  );
}
