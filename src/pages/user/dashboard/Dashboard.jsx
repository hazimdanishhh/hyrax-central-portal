import { useEffect, useState } from "react";
import MessageUI from "../../../components/messageUI/MessageUI";
import PageTransition from "../../../components/pageTransition/PageTransition";
import { useTheme } from "../../../context/ThemeContext";
import QuickActions from "../../../components/quickActions/QuickActions";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { CaretRight, House, Megaphone } from "phosphor-react";
import CardSection from "../../../components/cardSection/CardSection";
import AnnouncementCard from "../../../components/announcementCard/AnnouncementCard";
import { announcementData } from "../../../data/announcementData";
import CardLayout from "../../../components/cardLayout/CardLayout";
import { Link } from "react-router";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";

function Dashboard() {
  const { darkMode, toggleMode } = useTheme();
  const [message, setMessage] = useState({ text: "", type: "" });
  const [showExitTransition, setShowExitTransition] = useState(true);

  // Page Transition Animation + Message
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowExitTransition(false);
    }, 800); // Shorter duration to hide the circle

    setMessage({ text: `Welcome back `, type: "success" });

    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <PageTransition isVisible={showExitTransition} mode="exit" />
      <MessageUI message={message} setMessage={setMessage} />

      <section className={darkMode ? "sectionDark" : "sectionLight"}>
        <div className="sectionWrapper">
          <div className="sectionContent">
            <Breadcrumbs icon={House} current="Dashboard" />

            <CardWrapper>
              <QuickActions />

              <CardLayout style="cardLayout2">
                <div className="sectionContent">
                  <SectionHeader
                    icon={Megaphone}
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
                      <CaretRight weight="bold" />
                    </Link>
                  </CardLayout>
                </div>

                <div className="sectionContent">
                  <SectionHeader
                    icon={Megaphone}
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
                      <CaretRight weight="bold" />
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
