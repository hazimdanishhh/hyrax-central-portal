import { CaretRightIcon, PlusIcon } from "@phosphor-icons/react";
import "./QuickActionsCard.scss";
import { Link } from "react-router";
import { motion } from "framer-motion";

function QuickActionsCard({ icon, name, path, image, target, rel }) {
  const Icon = icon;

  return (
    <motion.div
      className="quickActionsWrapper"
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <Link
        className="quickActionsCard generalCard"
        to={path}
        target={target}
        rel={rel}
      >
        <div className="quickActionsCardTitle">
          {icon && <Icon size="18" />}
          {image && (
            <div className="quickActionsIconTest">
              <img src={image} alt={name} />
            </div>
          )}
          <p className="textRegular textXXXS">{name}</p>
        </div>

        {image ? (
          <div className="quickActionsPlusIcon">
            <CaretRightIcon />
          </div>
        ) : (
          <div className="quickActionsPlusIcon">
            <PlusIcon />
          </div>
        )}
      </Link>
    </motion.div>
  );
}

export default QuickActionsCard;
