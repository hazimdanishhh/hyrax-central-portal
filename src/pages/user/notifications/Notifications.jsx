import { useTheme } from "../../../context/ThemeContext";
import CardLayout from "../../../components/cardLayout/CardLayout";
import NotificationCard from "../../../components/notifications/notificationCard/NotificationCard";
import Button from "../../../components/buttons/button/Button";
import LoadingIcon from "../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../components/crud/noResult/NoResult";
import PageResult from "../../../components/crud/pageResult/PageResult";
import { BellIcon, CheckIcon } from "@phosphor-icons/react";
import CardWrapper from "../../../components/cardWrapper/CardWrapper";
import Breadcrumbs from "../../../components/breadcrumbs/Breadcrumbs";
import { formatRelativeTime } from "../../../functions/formatDate";
import { useNotifications } from "../../../features/notifications/private/hooks/useNotifications";
import useNotificationMutations from "../../../features/notifications/private/hooks/useNotificationMutations";

function Notifications() {
  const { darkMode } = useTheme();

  const {
    data: notifications,
    totalCount,
    totalPages,
    page,
    setPage,
    isLoading,
    error,
  } = useNotifications();
  const { markRead, markAllRead, markingAllRead } = useNotificationMutations();

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={BellIcon} current="Notifications" />
          <CardWrapper>
            <Button
              name="Mark All Read"
              style="button buttonType2"
              icon={CheckIcon}
              onClick={() => markAllRead()}
              disabled={markingAllRead}
            />

            <PageResult
              data={notifications}
              totalCount={totalCount}
              page={page}
              setPage={setPage}
              totalPages={totalPages}
              error={error}
            />

            <CardLayout>
              {isLoading ? (
                <LoadingIcon />
              ) : notifications.length === 0 ? (
                <NoResult />
              ) : (
                notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    to={notification.link_to || "/app/notifications"}
                    type={notification.type}
                    title={notification.title}
                    message={notification.message}
                    created_at={formatRelativeTime(notification.created_at)}
                    onClick={() => markRead(notification.id)}
                  />
                ))
              )}
            </CardLayout>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}

export default Notifications;
