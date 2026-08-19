import { useParams } from "react-router";
import { BookOpenIcon } from "@phosphor-icons/react";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import GuideStepList from "../../../../components/guides/guideStepList/GuideStepList";
import NoResult from "../../../../components/crud/noResult/NoResult";
import { salesGuideTopics } from "../../../../data/guides/salesGuideTopics";
import "./SalesGuideTopic.scss";

/**
 * One component for every guide topic -- the topic itself is just data
 * (salesGuideTopics), not a distinct page per topic. Standalone page (own
 * section/Breadcrumbs), not nested under a shared layout -- same shape as
 * EmployeeProfile.jsx relative to the Employees list page: the breadcrumb's
 * icon1/to1/name1 back-link to "Guides" is the only navigation back to the
 * card grid, there's no separate tab bar to fall back on.
 */
export default function SalesGuideTopic() {
  const { darkMode } = useTheme();
  const { topicId } = useParams();
  const topic = salesGuideTopics.find((t) => t.id === topicId);

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs
            icon1={BookOpenIcon}
            to1="/app/sales/guides"
            name1="Guides"
            current={topic?.label || "Guide Not Found"}
          />

          <CardWrapper>
            {!topic ? (
              <NoResult title="Guide not found" />
            ) : (
              <div className="salesGuideTopic">
                <div className="salesGuideTopicHeader">
                  {topic.label && (
                    <p className="textBold textL">{topic.label}</p>
                  )}
                  {topic.description && (
                    <p className="textRegular textXS">{topic.description}</p>
                  )}
                </div>

                <GuideStepList steps={topic.steps} />
              </div>
            )}
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
