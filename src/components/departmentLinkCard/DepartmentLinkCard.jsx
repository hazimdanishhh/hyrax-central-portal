import "./DepartmentLinkCard.scss";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { CaretRightIcon } from "@phosphor-icons/react";

function DepartmentLinkCard({ icon, label, description, path }) {
  const Icon = icon;

  return (
    <motion.div
      className="departmentLinkCardWrapper"
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <Link className="departmentLinkCard generalCard" to={`/app/${path}`}>
        <div className="departmentLinkCardHeader">
          <div className="departmentLinkCardIcon">
            {Icon && <Icon size="20" weight="bold" />}
          </div>
          <CaretRightIcon className="departmentLinkCardArrow" weight="bold" />
        </div>

        <div className="departmentLinkCardBody">
          <p className="textBold textXS">{label}</p>
          {description && (
            <p className="textLight textXXS">{description}</p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export default DepartmentLinkCard;
