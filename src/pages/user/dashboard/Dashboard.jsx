// pages/user/dashboard/Dashboard.jsx

import { useEffect, useState } from "react";
import PageTransition from "../../../components/pageTransition/PageTransition";
import { useTheme } from "../../../context/ThemeContext";
import QuickActions from "../../../components/quickActions/QuickActions";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import {
  CalendarDotsIcon,
  CaretRightIcon,
  HouseIcon,
  MegaphoneIcon,
} from "@phosphor-icons/react";
import CardSection from "../../../components/cardSection/CardSection";
import AnnouncementCard from "../../../components/announcementCard/AnnouncementCard";
import { announcementData } from "../../../data/announcementData";
import CardLayout from "../../../components/cardLayout/CardLayout";
import { Link } from "react-router";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import AttendanceActivity from "../../../components/attendanceActivity/AttendanceActivity";
import AttendanceActivityClockin from "../../../components/attendanceActivityClockin/AttendanceActivityClockin";
import { useMessage } from "../../../context/MessageContext";
import useUserProfile from "../../../hooks/useUserProfile";

function Dashboard() {
  const { darkMode } = useTheme();
  const { showMessage } = useMessage();
  const [showExitTransition, setShowExitTransition] = useState(true);

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
              {/* ATTENDANCE SYSTEM */}
              <CardLayout style="cardLayout1">
                <AttendanceActivityClockin />
                {/* <AttendanceActivity /> */}
              </CardLayout>

              <CardLayout style="cardLayout2">
                <div className="sectionContent">
                  <SectionHeader
                    icon={MegaphoneIcon}
                    title="Latest Announcements"
                  />
                  <CardLayout style="cardLayout1">
                    {announcementData
                      .reverse()
                      .slice(0, 2)
                      .map((announcement, index) => (
                        <AnnouncementCard
                          key={index}
                          name={announcement.name}
                          position={announcement.position}
                          date={announcement.date}
                          time={announcement.time}
                          title={announcement.title}
                          message={announcement.message}
                          link={announcement.link}
                          avatarUrl={announcement.avatarUrl}
                          truncate
                        />
                      ))}
                    <Link
                      to="/app/announcements"
                      className="button buttonType2"
                    >
                      View All
                      <CaretRightIcon weight="bold" />
                    </Link>
                  </CardLayout>
                </div>

                <div className="sectionContent">
                  <SectionHeader
                    icon={MegaphoneIcon}
                    title="Latest Announcements"
                  />
                  <CardLayout style="cardLayout1">
                    {announcementData
                      .reverse()
                      .slice(0, 2)
                      .map((announcement, index) => (
                        <AnnouncementCard
                          key={index}
                          name={announcement.name}
                          position={announcement.position}
                          date={announcement.date}
                          time={announcement.time}
                          title={announcement.title}
                          message={announcement.message}
                          link={announcement.link}
                          avatarUrl={announcement.avatarUrl}
                          truncate
                        />
                      ))}
                    <Link
                      to="/app/announcements"
                      className="button buttonType2"
                    >
                      View All
                      <CaretRightIcon weight="bold" />
                    </Link>
                  </CardLayout>
                </div>
              </CardLayout>
            </CardWrapper>
          </div>
        </div>
      </section>
    </>
  );
}

export default Dashboard;
