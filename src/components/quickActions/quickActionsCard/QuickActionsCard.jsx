import { Plus } from "phosphor-react";
import "./QuickActionsCard.scss";
import { Link } from "react-router";
import { motion } from "framer-motion";

function QuickActionsCard({ icon, name, path }) {
  const Icon = icon;

  return (
    <motion.div
      className="quickActionsWrapper"
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <Link className="quickActionsCard" to={path}>
        <div className="quickActionsCardTitle">
          <Icon size="18" />
          <p className="textRegular textXXXS">{name}</p>
        </div>
        <div className="quickActionsPlusIcon">
          <Plus />
        </div>
      </Link>
    </motion.div>
  );
}

export default QuickActionsCard;
