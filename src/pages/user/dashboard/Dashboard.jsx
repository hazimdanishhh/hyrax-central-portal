// pages/user/dashboard/Dashboard.jsx

import { FolderIcon, HouseIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import AttendanceActivityClockin from "../../../components/attendanceActivityClockin/AttendanceActivityClockin";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import CardLayout from "../../../components/cardLayout/CardLayout";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import DepartmentLinkCard from "../../../components/departmentLinkCard/DepartmentLinkCard";
import PageTransition from "../../../components/pageTransition/PageTransition";
import QuickActions from "../../../components/quickActions/QuickActions";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { useAccessControl } from "../../../context/AccessControlContext";
import { useMessage } from "../../../context/MessageContext";
import { useTheme } from "../../../context/ThemeContext";
import { departmentLinkCardData } from "../../../data/departmentLinkCardData";
import { quickActionsHome } from "../../../data/quickActionsCardData";
import GeneralAccessBanner from "../../../components/generalAccessBanner/GeneralAccessBanner";
import RecentProjects from "../../../components/workspace/recentProjects/RecentProjects";
import RecentTasks from "../../../components/workspace/recentTasks/RecentTasks";

function Dashboard() {
  const { darkMode } = useTheme();
  const { showMessage } = useMessage();
  const { canAccess, role, departmentSub } = useAccessControl();
  const [showExitTransition, setShowExitTransition] = useState(true);

  const departmentLinkSections = useMemo(() => {
    return departmentLinkCardData
      .map((segment) => ({
        ...segment,
        links: segment.links.filter((link) =>
          canAccess({ roles: link.roles, departments: link.departments }),
        ),
      }))
      .filter((segment) => segment.links.length > 0);
  }, [role, departmentSub]);

  // Page Transition Animation + Message
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowExitTransition(false);
    }, 800); // Shorter duration to hide the circle

    showMessage(`Welcome back!`, "success");

    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <PageTransition isVisible={showExitTransition} mode="exit" />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={HouseIcon} current="Dashboard" />

            <CardWrapper>
              <GeneralAccessBanner />

              <QuickActions
                quickActionsList={quickActionsHome}
                title="Web Services"
              />

              <div>
                <SectionHeader icon={FolderIcon} title="WORKSPACE" />
                <CardLayout style="cardLayout2">
                  <RecentProjects />
                  <RecentTasks />
                </CardLayout>
              </div>

              {departmentLinkSections.map((segment) => (
                <div key={segment.segmentCode}>
                  <SectionHeader
                    icon={segment.icon}
                    title={segment.segmentTitle}
                  />
                  <CardLayout style="cardLayout3">
                    {segment.links.map((link) => (
                      <DepartmentLinkCard
                        key={link.path}
                        icon={link.icon}
                        label={link.label}
                        description={link.description}
                        path={link.path}
                      />
                    ))}
                  </CardLayout>
                </div>
              ))}

              {/* ATTENDANCE SYSTEM */}
              {/* <CardLayout style="cardLayout1">
                <AttendanceActivityClockin />
              </CardLayout> */}
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}

export default Dashboard;
