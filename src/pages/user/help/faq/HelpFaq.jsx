import { useState } from "react";
import { useAccessControl } from "@/context/AccessControlContext";
import FaqAccordion from "@/components/help/faqAccordion/FaqAccordion";
import { helpFaqItems, HELP_DEPARTMENTS } from "@/data/help";

// Department chips are a soft convenience filter the viewer controls
// themselves -- pre-selecting their own department, never hiding content
// from anyone (Help stays universal/R2, see HelpPageLayout.jsx).
export default function HelpFaq() {
  const { departmentSub } = useAccessControl();
  const defaultDept = HELP_DEPARTMENTS.some((d) => d.code === departmentSub)
    ? departmentSub
    : "ALL";
  const [activeDept, setActiveDept] = useState(defaultDept);

  const visibleItems = helpFaqItems.filter(
    (item) =>
      activeDept === "ALL" ||
      item.departments.length === 0 ||
      item.departments.includes(activeDept),
  );

  return (
    <div className="helpTabContent">
      <div className="helpDeptChips">
        <button
          className={`button buttonType4 textXXS ${
            activeDept === "ALL" ? "active" : ""
          }`}
          onClick={() => setActiveDept("ALL")}
        >
          All
        </button>
        {HELP_DEPARTMENTS.map((dept) => (
          <button
            key={dept.code}
            className={`button buttonType4 textXXS ${
              activeDept === dept.code ? "active" : ""
            }`}
            onClick={() => setActiveDept(dept.code)}
          >
            {dept.label}
          </button>
        ))}
      </div>

      <FaqAccordion items={visibleItems} />
    </div>
  );
}
