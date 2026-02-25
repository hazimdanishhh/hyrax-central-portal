import { AnimatePresence, motion } from "framer-motion";
import LinkButton from "../../buttons/linkButton/LinkButton";
import CardLayout from "../../cardLayout/CardLayout";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import "./ITAssetList.scss";
import {
  CaretRightIcon,
  DesktopIcon,
  LaptopIcon,
  ComputerTowerIcon,
  WindowsLogoIcon,
  LinuxLogoIcon,
  CaretCircleRightIcon,
  AppleLogoIcon,
  PackageIcon,
  HardDriveIcon,
  SecurityCameraIcon,
  WifiHighIcon,
  NetworkIcon,
  DatabaseIcon,
  PrinterIcon,
  FingerprintIcon,
  TelevisionSimpleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useTheme } from "../../../context/ThemeContext";

export default function ITAssetList({ asset, onClick }) {
  const [showName, setShowName] = useState(false);
  const { darkMode } = useTheme();

  return (
    <motion.div
      className="generalCard ITAssetList"
      onClick={onClick}
      initial={{ y: 0 }}
      whileHover={{ y: -3 }}
    >
      <div className="listHeader">
        {/* ASSET LOGO ICONS */}
        <div className="ITAssetListIconContainer">
          {/* SUBCATEGORY */}
          {(() => {
            const name = asset.asset_subcategory?.name?.toLowerCase() || "";

            if (name.includes("desktop"))
              return <ComputerTowerIcon size={18} />;
            if (name.includes("laptop")) return <LaptopIcon size={18} />;
            if (name.includes("monitor")) return <DesktopIcon size={18} />;
            if (name.includes("cctv")) return <SecurityCameraIcon size={18} />;
            if (/modem|router|mesh|combo box|access point/i.test(name)) {
              return <WifiHighIcon size={18} />;
            }
            if (name.includes("switch")) return <NetworkIcon size={18} />;
            if (name.includes("nas")) return <DatabaseIcon size={18} />;
            if (name.includes("printer")) return <PrinterIcon size={18} />;
            if (name.includes("fingerprint"))
              return <FingerprintIcon size={18} />;
            if (name.includes("tv")) return <TelevisionSimpleIcon size={18} />;

            // fallback
            return <PackageIcon size={18} />;
          })()}

          {/* OPERATING SYSTEM */}
          {(() => {
            const os = asset.operating_system?.name?.toLowerCase() || "";

            if (os.includes("windows")) return <WindowsLogoIcon size={18} />;
            if (os.includes("ios") || os.includes("mac"))
              return <AppleLogoIcon size={18} />;
            if (os.includes("linux")) return <LinuxLogoIcon size={18} />;

            // fallback
            return <HardDriveIcon size={18} />;
          })()}
        </div>

        {/* ASSET CODE AND NAME */}
        <div className="listSegment">
          <p className="textBold textXXS">{asset.asset_name || "No Name"}</p>
          <p className="textLight textXXXS">{asset.asset_code || "No Code"}</p>
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
        <p className="textLight textXXXS">
          {asset.asset_category?.name || "No Category"}
        </p>
        <p className="textLight textXXXS">
          {asset.asset_subcategory?.name || "No Subcategory"}
        </p>
      </div>

      <div className="listSegment listSegmentMobile">
        <p className="textLight textXXXS">
          {asset.manufacturer?.name || "No Manufacturer"}
        </p>
        <p className="textLight textXXXS">{asset.model?.name || "No Model"}</p>
      </div>

      <div className="listSegment listSegmentStatusContainer">
        {asset.mdm_link && (
          <LinkButton
            style="textLight textXXXS button buttonType3"
            href={asset.mdm_link}
            name={asset.mdm_status}
            icon={CaretRightIcon}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {asset.asset_user && (
          <a
            className="listEmployeePhoto"
            href={`/app/employees/${asset.asset_user?.id}`}
            onMouseEnter={() => setShowName(true)}
            onMouseLeave={() => setShowName(false)}
          >
            <img
              src={
                asset.asset_user?.profile?.avatar_url
                  ? `${asset.asset_user?.profile?.avatar_url}`
                  : "/profilePhoto/default.webp"
              }
              alt={asset.asset_user?.full_name}
            />
            <AnimatePresence mode="wait">
              {showName && (
                <motion.div
                  className={
                    darkMode
                      ? "textRegular textXXXS listEmployeePhotoName sectionDark"
                      : "textRegular textXXXS listEmployeePhotoName sectionLight"
                  }
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {asset.asset_user?.full_name}
                </motion.div>
              )}
            </AnimatePresence>
          </a>
        )}
        <div className="listArrow">
          <CaretCircleRightIcon size={28} weight="light" />
        </div>
      </div>
    </motion.div>
  );
}
