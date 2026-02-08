import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import { useTheme } from "../../../context/ThemeContext";
import { announcementData } from "../../../data/announcementData";
import AnnouncementCard from "../../../components/announcementCard/AnnouncementCard";
import { CaretRight, Megaphone } from "phosphor-react";
import { Link } from "react-router";
import CardLayout from "../../../components/cardLayout/CardLayout";
import CardSection from "../../../components/cardSection/CardSection";
import { useState } from "react";
import Button from "../../../components/buttons/button/Button";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";

function Announcements() {
  const { darkMode } = useTheme();

  // State to control how many notifications are shown
  const [visibleCount, setVisibleCount] = useState(10);

  // Handle "Load More"
  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  // Reverse notificationData
  const announcements = [...announcementData].reverse();

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={Megaphone} current="Announcements" />

          <CardWrapper>
            <CardLayout style="cardLayout1">
              {announcements
                .reverse()
                .slice(0, visibleCount)
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
                  />
                ))}
              {/* Only show the Load More button if there are more notifications */}
              {visibleCount < announcements.length ? (
                <Button
                  name="Load More"
                  style="button buttonType2"
                  icon={CaretRight}
                  onClick={handleLoadMore}
                />
              ) : (
                <p>You have no more announcements</p>
              )}
            </CardLayout>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}

export default Announcements;
