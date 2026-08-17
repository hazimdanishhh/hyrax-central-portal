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
import SearchFilterBar from "../../../components/searchFilterBar/SearchFilterBar";
import ActiveFiltersBar from "../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import { formatRelativeTime } from "../../../functions/formatDate";
import { useNotifications } from "../../../features/notifications/private/hooks/useNotifications";
import useNotificationMutations from "../../../features/notifications/private/hooks/useNotificationMutations";
import { getNotificationsFilterConfig } from "./filterConfig";

function Notifications() {
  const { darkMode } = useTheme();

  const {
    data: notifications,
    totalCount,
    totalPages,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilters,
    activeFilters,
    hasActiveFilters,
    resetParams,
    isLoading,
    error,
  } = useNotifications();
  const { markRead, markAllRead, markingAllRead } = useNotificationMutations();

  const filterConfig = getNotificationsFilterConfig();

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={BellIcon} current="Notifications" />
          <CardWrapper>
            {/* SEARCH AND FILTER BAR */}
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search notifications..."
            />

            <Button
              name="Mark All Read"
              style="button buttonType2"
              icon={CheckIcon}
              onClick={() => markAllRead()}
              disabled={markingAllRead}
            />

            {/* ACTIVE FILTERS */}
            {hasActiveFilters && (
              <ActiveFiltersBar
                search={search}
                setSearch={setSearch}
                filters={activeFilters}
                setFilters={setFilters}
                filterConfig={filterConfig}
                resetParams={resetParams}
              />
            )}

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
                    read={notification.read_status}
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
