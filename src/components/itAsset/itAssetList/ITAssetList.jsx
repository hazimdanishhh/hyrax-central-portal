import { motion } from "framer-motion";
import LinkButton from "../../buttons/linkButton/LinkButton";
import CardLayout from "../../cardLayout/CardLayout";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import "./ITAssetList.scss";
import {
  CaretRight,
  Desktop,
  Laptop,
  ComputerTower,
  WindowsLogo,
  LinuxLogo,
  DeviceMobileCamera,
  CaretCircleRight,
  AppleLogo,
  Package,
  HardDrive,
} from "phosphor-react";

export default function ITAssetList({ asset, onClick }) {
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

            if (name.includes("desktop")) return <ComputerTower size={18} />;
            if (name.includes("laptop")) return <Laptop size={18} />;

            // fallback
            return <Package size={18} />;
          })()}

          {/* OPERATING SYSTEM */}
          {(() => {
            const os = asset.operating_system?.name?.toLowerCase() || "";

            if (os.includes("windows")) return <WindowsLogo size={18} />;
            if (os.includes("ios") || os.includes("mac"))
              return <AppleLogo size={18} />;
            if (os.includes("linux")) return <LinuxLogo size={18} />;

            // fallback
            return <HardDrive size={18} />;
          })()}
        </div>

        {/* ASSET CODE AND NAME */}
        <div className="listSegment">
          <p className="textBold textXXS">{asset.asset_name || "No Name"}</p>
          <p className="textLight textXXXS">{asset.asset_code || "No Code"}</p>
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

      {asset.mdm_link ? (
        <LinkButton
          style="textLight textXXXS button buttonType3"
          href={asset.mdm_link}
          name={asset.mdm_status}
          icon={CaretRight}
        ></LinkButton>
      ) : (
        <LinkButton
          style="textLight textXXXS "
          name={asset.mdm_status}
        ></LinkButton>
      )}

      <div className="listStatusContainer">
        <StatusBadge
          status={
            asset.asset_status?.name || asset.asset_status_id || "No Status"
          }
        />
        <div className="listEmployeePhoto">
          <img
            src={
              asset.asset_user
                ? `${asset.asset_user?.profile?.avatar_url}`
                : "/profilePhoto/default.webp"
            }
            alt={asset.asset_user?.full_name}
          />
        </div>
        <div className="listArrow">
          <CaretCircleRight size={28} weight="light" />
        </div>
      </div>
    </motion.div>
  );
}
