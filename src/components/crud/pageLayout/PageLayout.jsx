import Button from "../../buttons/button/Button";
import CardLayout from "../../cardLayout/CardLayout";

export default function PageLayout({
  layout,
  setLayout,
  options = [],
  addButton,
}) {
  // find current layout option
  const current = options.find((opt) => opt.value === layout);

  // find the "other" layout (toggle behavior)
  const next = options.find((opt) => opt.value !== layout);

  return (
    <CardLayout style="cardLayoutFlex cardGapMedium cardLayoutNoPadding">
      {next && (
        <Button
          icon={next.icon}
          tooltipName={next.tooltipName}
          style="button buttonType5 textXXS"
          name="Change View"
          onClick={() => setLayout(next.value)}
        />
      )}

      {addButton && (
        <Button
          name={addButton.name}
          icon2={addButton.icon}
          style="button buttonType5 textXXS"
          onClick={addButton.onClick}
        />
      )}
    </CardLayout>
  );
}
