import CardLayout from "@/components/cardLayout/CardLayout";
import DepartmentLinkCard from "@/components/departmentLinkCard/DepartmentLinkCard";
import FaqAccordion from "@/components/help/faqAccordion/FaqAccordion";
import { helpGuideItems } from "@/data/help";

export default function HelpGuides() {
  const linkItems = helpGuideItems.filter((item) => item.type === "link");
  const guideItems = helpGuideItems.filter((item) => item.type === "guide");

  return (
    <div className="helpTabContent">
      <CardLayout style="cardLayout3">
        {linkItems.map((item) => (
          <DepartmentLinkCard
            key={item.id}
            icon={item.icon}
            label={item.title}
            description={item.summary}
            path={item.path}
          />
        ))}
      </CardLayout>

      <FaqAccordion items={guideItems} />
    </div>
  );
}
