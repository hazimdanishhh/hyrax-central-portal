import "./NotificationsCard.scss";
import { motion } from "framer-motion";
import {
  CaretRightIcon,
  CheckIcon,
  InfoIcon,
  WarningIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import { Link } from "react-router";

function NotificationCard({
  to,
  type,
  title,
  message,
  created_at,
  onClick,
  truncate,
}) {
  const truncatedMessage =
    message.length > 60 ? message.slice(0, 60) + "..." : message;

  return (
    <motion.div
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
      title={message}
      onClick={onClick}
    >
      <Link to={to} className="notificationCard">
        <div
          className={
            type === "info"
              ? "notificationTitle info"
              : type === "warning"
                ? "notificationTitle warning"
                : type === "error"
                  ? "notificationTitle error"
                  : type === "success"
                    ? "notificationTitle success"
                    : null
          }
        >
          {type === "info" ? (
            <InfoIcon size="20" />
          ) : type === "warning" ? (
            <WarningOctagonIcon size="20" />
          ) : type === "error" ? (
            <WarningIcon size="20" />
          ) : type === "success" ? (
            <CheckIcon size="20" />
          ) : null}
          <div className="textRegular textXS">{title}</div>
        </div>
        <div className="textLight textXXS">
          {truncate ? truncatedMessage : message}
        </div>
        <div className="textBold textXXXS">{created_at}</div>
        <div className="notificationViewButton textXXS">
          View
          <CaretRightIcon weight="bold" />
        </div>
      </Link>
    </motion.div>
  );
}

export default NotificationCard;
