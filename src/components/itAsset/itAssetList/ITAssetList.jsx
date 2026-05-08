import { AnimatePresence, motion } from "framer-motion";
import LinkButton from "../../buttons/linkButton/LinkButton";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import "./ITAssetList.scss";
import { CaretRightIcon, CaretCircleRightIcon } from "@phosphor-icons/react";
import * as Icons from "@phosphor-icons/react";
import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import EmployeeImage from "../../employees/employeeImage/EmployeeImage";

export default function ITAssetList({ asset, onClick, saving, deleting }) {
  const [showName, setShowName] = useState(false);
  const { darkMode } = useTheme();

  // Icon Helper
  const getIcon = (iconName, fallback) => {
    // Check if the iconName exists in the Phosphor Icons object
    const IconComponent = Icons[iconName];

    // If it exists, return it; otherwise, return the fallback component
    return IconComponent || fallback;
  };

  // 2. Resolve the icon components
  const SubcategoryIcon = getIcon(
    asset.asset_subcategory?.icon,
    Icons.PackageIcon,
  );
  const OSIcon = getIcon(asset.operating_system?.icon, Icons.HardDriveIcon);

  return (
    <div
      className="generalCard ITAssetList"
      onClick={saving ? null : deleting ? null : onClick}
    >
      <div className="listHeader">
        {/* ASSET LOGO ICONS */}
        <div className="ITAssetListIconContainer">
          {/* SUBCATEGORY */}
          <SubcategoryIcon size={18} />

          {/* OPERATING SYSTEM */}
          <OSIcon size={18} />
        </div>

        {/* ASSET CODE AND NAME */}
        <div className="listSegment">
          <p className="textBold textXXS truncate" title={asset.asset_name}>
            {asset.asset_name || "No Name"}
          </p>
          <p className="textLight textXXXS truncate">
            {asset.asset_code || "No Code"}
          </p>
        </div>

        <div className="listSegment listSegmentStatus">
          <StatusBadge
            status={
              asset.asset_status?.name || asset.asset_status_id || "No Status"
            }
          />
        </div>
      </div>

      <div className="listSegment listSegmentMobile">
        <p
          className="textLight textXXXS truncate"
          title={asset.asset_category?.name}
        >
          {asset.asset_category?.name || "No Category"}
        </p>
        <p
          className="textLight textXXXS truncate"
          title={asset.asset_subcategory?.name}
        >
          {asset.asset_subcategory?.name || "No Subcategory"}
        </p>
      </div>

      <div className="listSegment listSegmentMobile">
        <p
          className="textLight textXXXS truncate"
          title={asset.asset_manufacturer?.name}
        >
          {asset.asset_manufacturer?.name || "No Manufacturer"}
        </p>
        <p className="textLight textXXXS truncate" title={asset.asset_model}>
          {asset.asset_model || "No Model"}
        </p>
      </div>

      <div className="listSegment listSegmentStatusContainer">
        {asset.mdm_link && asset.mdm_status === "Enrolled" && (
          <LinkButton
            style="textLight textXXXS button buttonType3"
            href={asset.mdm_link}
            name={asset.mdm_status}
            icon={CaretRightIcon}
            onClick={(e) => e.stopPropagation()}
            size={14}
          />
        )}

        {asset.asset_user && (
          <EmployeeImage
            employee={asset.asset_user}
            setShowName={setShowName}
            showName={showName}
            position="left"
            employeeId={asset.asset_user.id}
          />
        )}

        <div className="listArrow">
          <CaretCircleRightIcon size={28} weight="light" />
        </div>
      </div>
    </div>
  );
}
