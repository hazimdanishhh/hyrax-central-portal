import { useTheme } from "../../../context/ThemeContext";
import CardSection from "../../../components/cardSection/CardSection";
import SectionHeader from "../../../components/sectionHeader/SectionHeader";
import CardLayout from "../../../components/cardLayout/CardLayout";
import { notificationData } from "../../../data/notificationData";
import NotificationCard from "../../../components/notifications/notificationCard/NotificationCard";
import { useState } from "react";
import Button from "../../../components/buttons/button/Button";
import { Bell, CaretRight } from "phosphor-react";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";

function Notifications() {
  const { darkMode } = useTheme();

  // State to control how many notifications are shown
  const [visibleCount, setVisibleCount] = useState(10);

  // Handle "Load More"
  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  // Reverse notificationData
  const notifications = [...notificationData].reverse();

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={Bell} current="Notifications" />
          <CardWrapper>
            <CardLayout>
              {notifications
                .slice(0, visibleCount)
                .map((notification, index) => (
                  <NotificationCard
                    key={index}
                    to={notification.to}
                    type={notification.type}
                    title={notification.title}
                    message={notification.message}
                    created_at={notification.created_at}
                  />
                ))}

              {/* Only show the Load More button if there are more notifications */}
              {visibleCount < notifications.length ? (
                <Button
                  name="Load More"
                  style="button buttonType2"
                  icon={CaretRight}
                  onClick={handleLoadMore}
                />
              ) : (
                <p>You have no more notifications</p>
              )}
            </CardLayout>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}

export default Notifications;
