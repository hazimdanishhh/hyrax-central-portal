import { Link } from "react-router";
import "./AnnouncementCard.scss";
import { CaretRight } from "phosphor-react";
import { motion } from "framer-motion";

function AnnouncementCard({
  name,
  position,
  date,
  time,
  title,
  message,
  link,
  avatarUrl,
  truncate,
}) {
  const truncatedMessage =
    message.length > 80 ? message.slice(0, 80) + "..." : message;

  return (
    <motion.div
      className="announcementCard"
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="announcementCardHeader">
        <div className="announcementCardProfile">
          <div className="profilePhoto">
            <img src={avatarUrl} alt="" />
          </div>
          <div className="announcementCardProfileDetails">
            <p className="textXXS textRegular">{name}</p>
            <p className="textXXXS textLight">{position}</p>
          </div>
        </div>
        <div className="announcementCardDate">
          <p className="textBold textXXXS">{time}</p>
          <p className="textXXXS">{date}</p>
        </div>
      </div>

      <div className="announcementCardContent">
        <p className="announcementTitle textXS textBold">{title}</p>
        <p
          className="announcementMessage textXXS"
          title={truncate ? message : null}
        >
          {truncate ? truncatedMessage : message}
        </p>
      </div>
      {truncate && (
        <Link className="announcementCardViewButton textXXS" to={link}>
          View
          <CaretRight weight="bold" />
        </Link>
      )}
    </motion.div>
  );
}

export default AnnouncementCard;
