import { useEffect, useState } from "react";
import MessageUI from "../../../components/messageUI/MessageUI";
import PageTransition from "../../../components/pageTransition/PageTransition";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import QuickActions from "../../../components/quickActions/QuickActions";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { CaretRight, Megaphone } from "phosphor-react";
import CardSection from "../../../components/cardSection/CardSection";
import AnnouncementCard from "../../../components/announcementCard/AnnouncementCard";
import { announcementData } from "../../../data/announcementData";
import CardLayout from "../../../components/cardLayout/CardLayout";
import { Link } from "react-router";

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
            <QuickActions />
          </div>
        </div>
      </section>

      <div className="sectionHalf">
        <section className={darkMode ? "sectionDark" : "sectionLight"}>
          <div className="sectionWrapper">
            <div className="sectionContent">
              <CardSection>
                <SectionHeader icon={Megaphone} title="LATEST ANNOUNCEMENTS" />
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
                  <Link to="/app/announcements" className="button buttonType2">
                    View All
                    <CaretRight weight="bold" />
                  </Link>
                </CardLayout>
              </CardSection>
            </div>
          </div>
        </section>
        <section className={darkMode ? "sectionDark" : "sectionLight"}>
          <div className="sectionWrapper">
            <div className="sectionContent">
              <SectionHeader icon={Megaphone} title="LATEST ANNOUNCEMENTS" />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Dashboard;
