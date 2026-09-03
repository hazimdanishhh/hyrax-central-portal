import { CaretCircleRightIcon, NotePencilIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import CardLayout from "../../cardLayout/CardLayout";
import StatusBox from "../../status/statusBox/StatusBox";

export default function UserList({ user, onClick, saving, deleting }) {
  return (
    <motion.div
      className="employeeList generalCard"
      onClick={saving ? null : deleting ? null : onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="employeeListHeaderContainer">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <div className="employeeCardPhoto">
            <img
              src={user.avatar_url || "/profilePhoto/default.webp"}
              alt={user.full_name}
            />
          </div>
          <p className="textBold textXXS">{user.full_name}</p>
          <StatusBox status={user.department?.sub} type="dark" />
        </div>
        <div className="employeeCardStatusContainer">
          <div className="employeeCardHeaderDetails">
            <StatusBox
              status={user.role?.name}
              type={
                user.role?.name === "staff"
                  ? "green"
                  : user.role?.name === "manager"
                    ? "blue"
                    : "yellow"
              }
            />
          </div>

          <button className="listArrow iconButton2">
            <NotePencilIcon size={16} weight="light" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
