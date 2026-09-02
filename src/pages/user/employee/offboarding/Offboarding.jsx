import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import PageTitle from "../../../../components/pageTitle/PageTitle";
import IconCard from "../../../../components/iconCard/IconCard";
import { DoorOpenIcon, ClockIcon } from "@phosphor-icons/react";
import ChecklistItemCard from "../../../../components/employeeLifecycle/checklistItemCard/ChecklistItemCard";
import { useMyLifecycleCase } from "../../../../features/employeeLifecycle/public/hooks/useMyLifecycleCase";
import { getItemMeta } from "../../../../features/employeeLifecycle/private/lifecycleCaseHelpers";
import { formatDate } from "../../../../functions/formatDate";

/**
 * Read-only self-service view of the current employee's own open
 * offboarding case -- renders nothing until BOTH RLS conditions are true
 * (employee_can_view on the case, employee_visible on each item; see
 * docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's two-layer visibility
 * gate). fetchMyLifecycleCase already enforces this server-side -- a case
 * HR hasn't yet made visible simply returns null here, the correct
 * "nothing to show yet" result, not an error. `canAct` is hardcoded false
 * for every item -- the employee never checks off anything, for either
 * checklist, by deliberate design.
 */
export default function Offboarding() {
  const { darkMode } = useTheme();
  const { lifecycleCase, isLoading, error } = useMyLifecycleCase("OFFBOARDING");

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={DoorOpenIcon} current="Offboarding" />

          <CardWrapper>
            <PageTitle title="Your Offboarding" subtitle="What to expect before your last day." />

            {isLoading ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : error ? (
              // Same distinction as Onboarding.jsx -- a thrown query error
              // must never be confused with the legitimate "no case, or
              // employee_can_view is still false" empty result below.
              <NoResult title="Couldn't load your offboarding. Try refreshing, or contact HR/IT if this keeps happening." />
            ) : !lifecycleCase ? (
              <NoResult title="Nothing to show yet." />
            ) : (
              <>
                {lifecycleCase.expected_last_day && (
                  <IconCard
                    icon={ClockIcon}
                    weight="fill"
                    name={`Last working day: ${formatDate(lifecycleCase.expected_last_day)}`}
                    style="yellow textXS"
                  />
                )}

                <CardLayout style="cardLayout1 cardGapSmall">
                  {lifecycleCase.items.map((item) => (
                    <ChecklistItemCard
                      key={item.id}
                      item={item}
                      itemMeta={getItemMeta(lifecycleCase.case_type, item.item_key)}
                      canAct={false}
                    />
                  ))}
                </CardLayout>
              </>
            )}
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
