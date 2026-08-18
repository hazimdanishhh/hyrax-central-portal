import { InfoIcon } from "@phosphor-icons/react";
import { Link } from "react-router";
import { useTheme } from "@/context/ThemeContext";
import Breadcrumbs from "@/components/breadcrumbs/Breadcrumbs";
import CardWrapper from "@/components/cardWrapper/CardWrapper";
import StatusBadge from "@/components/status/statusBadge/StatusBadge";
import FaqAccordion from "@/components/help/faqAccordion/FaqAccordion";
import {
  changelogEntries,
  CURRENT_VERSION,
  CURRENT_STATUS,
} from "@/data/changelogData";
import "./About.scss";
import logo from "/src/assets/favicon.svg";
import StatusBox from "../../../components/status/statusBox/StatusBox";

const STATUS_LABELS = {
  uat: "UAT",
  stable: "Stable",
};

function formatEntryDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toAccordionItem(entry, index) {
  const heading = `v${entry.version} — ${entry.title} (${formatEntryDate(entry.date)})`;

  return {
    id: entry.version,
    title: index === 0 ? `${heading} · Current` : heading,
    body: entry.modules
      .map(
        (m) => `**${m.module}**\n${m.changes.map((c) => `- ${c}`).join("\n")}`,
      )
      .join("\n\n"),
  };
}

export default function About() {
  const { darkMode } = useTheme();
  const accordionItems = changelogEntries.map(toAccordionItem);

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={InfoIcon} current="About" />

          <CardWrapper>
            <div className="aboutTabContent">
              <div className="aboutHeader">
                <div className="aboutLogoRow">
                  <img
                    src={logo}
                    alt="Hyrax Portal Logo"
                    style={{ width: "50px" }}
                  />
                  <h2 className="textL">Hyrax Portal</h2>
                  <div className="aboutVersionRow">
                    <StatusBox status={`V${CURRENT_VERSION}`} type="blue" />
                    <StatusBadge
                      status={STATUS_LABELS[CURRENT_STATUS] || CURRENT_STATUS}
                    />
                  </div>
                </div>
                <p className="textRegular textS">
                  A unified central portal for Hyrax Oil staff, enhancing team
                  collaboration, productivity and decision-making.
                  <br />
                  It provides a single point of access to various internal
                  tools, resources, and information, streamlining workflows and
                  improving efficiency across the organization.
                </p>

                <p className="textLight textXS">
                  HR, Sales, and Workspace are currently in User Acceptance
                  Testing. Found something odd?{" "}
                  <Link to="/app/help/contact">Let us know</Link>.
                </p>
              </div>

              <div className="aboutChangelog">
                <h2 className="textL">What&apos;s New</h2>
                <FaqAccordion items={accordionItems} />
              </div>
            </div>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
