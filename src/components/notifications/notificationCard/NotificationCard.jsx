import "./NotificationsCard.scss";
import { motion } from "framer-motion";
import {
  CaretRight,
  Check,
  Info,
  Warning,
  WarningOctagon,
} from "phosphor-react";
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
            <Info size="20" />
          ) : type === "warning" ? (
            <WarningOctagon size="20" />
          ) : type === "error" ? (
            <Warning size="20" />
          ) : type === "success" ? (
            <Check size="20" />
          ) : null}
          <div className="textRegular textXS">{title}</div>
        </div>
        <div className="textLight textXXS">
          {truncate ? truncatedMessage : message}
        </div>
        <div className="textBold textXXXS">{created_at}</div>
        <div className="notificationViewButton textXXS">
          View
          <CaretRight weight="bold" />
        </div>
      </Link>
    </motion.div>
  );
}

export default NotificationCard;
