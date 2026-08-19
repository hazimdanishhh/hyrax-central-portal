import { useMemo, useState } from "react";
import { BookOpenIcon } from "@phosphor-icons/react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import NoResult from "../../../../components/crud/noResult/NoResult";
import HelpSearchBar from "../../../../components/help/helpSearchBar/HelpSearchBar";
import DepartmentLinkCard from "../../../../components/departmentLinkCard/DepartmentLinkCard";
import { salesGuideTopics } from "../../../../data/guides/salesGuideTopics";

// Matches on the topic's own title/description, or any of its step titles --
// a step-title hit still surfaces its parent topic, since there's no
// per-step deep link/anchor to jump to within a topic.
function matchesQuery(topic, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (topic.label.toLowerCase().includes(q)) return true;
  if (topic.description?.toLowerCase().includes(q)) return true;

  return topic.steps.some((step) => step.title.toLowerCase().includes(q));
}

/**
 * Landing page for Sales Guides -- a search bar (same component/behavior as
 * Help & Support's) over a grid of card links, one per guide topic, each
 * opening its own full detail page (SalesGuideTopic.jsx) rather than
 * switching tabs in place.
 */
export default function SalesGuides() {
  const { darkMode } = useTheme();
  const [search, setSearch] = useState("");

  const filteredTopics = useMemo(
    () => salesGuideTopics.filter((topic) => matchesQuery(topic, search)),
    [search],
  );

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={BookOpenIcon} current="Sales Guides" />

          <CardWrapper>
            <HelpSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search guides by title..."
            />

            {filteredTopics.length === 0 ? (
              <NoResult title="No matching guides" />
            ) : (
              <CardLayout style="cardLayout3">
                {filteredTopics.map((topic) => (
                  <DepartmentLinkCard
                    key={topic.id}
                    icon={topic.icon}
                    label={topic.label}
                    description={topic.description}
                    path={`sales/guides/${topic.id}`}
                  />
                ))}
              </CardLayout>
            )}
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
