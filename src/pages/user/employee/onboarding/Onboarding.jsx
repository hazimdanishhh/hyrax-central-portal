import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import PageTitle from "../../../../components/pageTitle/PageTitle";
import StatusBadge from "../../../../components/status/statusBadge/StatusBadge";
import { HandWavingIcon } from "@phosphor-icons/react";
import { useMyLifecycleCase } from "../../../../features/employeeLifecycle/public/hooks/useMyLifecycleCase";
import { ONBOARDING_MILESTONES, ONBOARDING_CHECKLIST_ITEMS } from "../../../../data/onboardingChecklistMeta";

/**
 * Read-only self-service view of the current employee's own open
 * onboarding case -- collapsed into 4 simplified milestones (see
 * onboardingChecklistMeta.js's ONBOARDING_MILESTONES), not the raw
 * internal item labels HR/IT see. The employee never checks off anything
 * here, per docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's "Employee
 * self-service: read-only" design -- this is pure display.
 */
export default function Onboarding() {
  const { darkMode } = useTheme();
  const { lifecycleCase, isLoading } = useMyLifecycleCase("ONBOARDING");

  const milestoneStatus = {};
  if (lifecycleCase) {
    const itemsByKey = new Map(lifecycleCase.items.map((i) => [i.item_key, i]));
    Object.keys(ONBOARDING_MILESTONES).forEach((milestoneKey) => {
      const milestoneItems = ONBOARDING_CHECKLIST_ITEMS.filter((m) => m.milestone === milestoneKey)
        .map((m) => itemsByKey.get(m.key))
        .filter(Boolean);

      if (!milestoneItems.length) {
        milestoneStatus[milestoneKey] = null; // e.g. Device Handover when needs_it_asset isn't true
      } else if (milestoneItems.every((i) => i.status === "DONE" || i.status === "SKIPPED")) {
        milestoneStatus[milestoneKey] = "done";
      } else if (milestoneItems.some((i) => i.status === "DONE" || i.status === "IN_PROGRESS")) {
        milestoneStatus[milestoneKey] = "in_progress";
      } else {
        milestoneStatus[milestoneKey] = "pending";
      }
    });
  }

  const STATUS_LABEL = { done: "Done", in_progress: "In Progress", pending: "Pending" };
  const STATUS_TYPE = { done: "green", in_progress: "blue", pending: "grey" };

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={HandWavingIcon} current="Onboarding" />

          <CardWrapper>
            <PageTitle title="Your Onboarding" subtitle="Where you stand right now." />

            {isLoading ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : !lifecycleCase ? (
              <NoResult title="No onboarding in progress." />
            ) : (
              <CardLayout style="cardLayout1 cardGapSmall">
                {Object.entries(ONBOARDING_MILESTONES).map(([key, label]) => {
                  const status = milestoneStatus[key];
                  if (status === null || status === undefined) return null;

                  return (
                    <div key={key} className="generalCard cardPaddingSmall">
                      <p className="textBold textXS">{label}</p>
                      <StatusBadge status={STATUS_LABEL[status]} type={STATUS_TYPE[status]} />
                    </div>
                  );
                })}

                {lifecycleCase.status === "COMPLETED" && (
                  <p className="textLight textXS">
                    Your onboarding is complete. Welcome aboard!
                  </p>
                )}
              </CardLayout>
            )}
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
