import { CaretCircleRightIcon, NotePencilIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import CardLayout from "../../cardLayout/CardLayout";

export default function UserList({ user, onClick, saving, deleting }) {
  return (
    <motion.div
      className="employeeList generalCard"
      onClick={saving ? null : deleting ? null : onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="employeeCardHeaderContainer">
        <div className="employeeCardPhoto">
          <img
            src={user.avatar_url || "/profilePhoto/default.webp"}
            alt={user.full_name}
          />
        </div>

        <div className="employeeCardHeaderDetails">
          <p className="textBold textXXS">{user.full_name}</p>
          <p className="textRegular textXXXS">{user.department?.name}</p>
          <p className="textLight textXXXS">{user.role?.name}</p>
        </div>
        <div className="employeeCardStatusContainer">
          <button className="listArrow iconButton2">
            <NotePencilIcon size={16} weight="light" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
