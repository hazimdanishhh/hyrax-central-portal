import LinkButton from "../../buttons/linkButton/LinkButton";
import CardLayout from "../../cardLayout/CardLayout";
import StatusBadge from "../../status/statusBadge/StatusBadge";
import "./ITAssetCard.scss";
import {
  CaretRightIcon,
  DesktopIcon,
  LaptopIcon,
  ComputerTowerIcon,
  WindowsLogoIcon,
  LinuxLogoIcon,
  DeviceMobileCameraIcon,
} from "@phosphor-icons/react";

function ITAssetCard({ asset, onClick }) {
  return (
    <button className="generalCard itAssetCard" onClick={onClick}>
      <div className="itAssetCardHeader">
        <StatusBadge
          status={asset.asset_status?.name || asset.asset_status_id || "null"}
        />
        <div className="itAssetCardHeaderDetails">
          {/* ASSET LOGO ICONS */}
          <div>
            {/* Asset subcategory */}
            {asset.asset_subcategory?.name
              ?.toLowerCase()
              .includes("desktop") && <DesktopIcon size={24} />}

            {/* Operating system */}
            {asset.operating_system?.name
              ?.toLowerCase()
              .includes("windows") && <WindowsLogoIcon size={24} />}

            {asset.operating_system?.name?.toLowerCase().includes("linux") && (
              <LinuxLogoIcon size={24} />
            )}
          </div>

          {/* ASSET CODE AND NAME */}
          <div className="itAssetCardHeaderCode">
            <p className="textBold textXS">{asset.asset_name || "null"}</p>
            <p className="textLight textXXS">({asset.asset_code || "null"})</p>
          </div>
        </div>
      </div>
      <CardLayout style="cardLayout2">
        <p className="textLight textXXXS">
          <strong className="textBold">ID:</strong> {asset.id || "null"}
        </p>

        {/* Categories */}
        <p className="textLight textXXS">
          <strong className="textBold">Category:</strong>{" "}
          {asset.asset_category?.name || asset.asset_category_id || "null"}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Subcategory:</strong>{" "}
          {asset.asset_subcategory?.name ||
            asset.asset_subcategory_id ||
            "null"}
        </p>

        {/* Assigned User */}
        <p className="textLight textXXS">
          <strong className="textBold">Assigned User:</strong>{" "}
          {asset.asset_user?.full_name || asset.asset_user_id || "null"}
        </p>

        {/* MDM */}
        <p className="textLight textXXS">
          <strong className="textBold">MDM Status:</strong>{" "}
          {asset.mdm_status || "null"}
        </p>
        {asset.mdm_link && (
          <LinkButton
            href={asset.mdm_link}
            name="MDM Link"
            style="button buttonType2"
            icon={CaretRightIcon}
          />
        )}

        {/* Manufacturer / Model */}
        <p className="textLight textXXS">
          <strong className="textBold">Manufacturer:</strong>{" "}
          {asset.manufacturer?.name || asset.manufacturer_id || "null"}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Model:</strong>{" "}
          {asset.model?.name || asset.model_id || "null"}
        </p>

        {/* Serial / OS / Keys */}
        <p className="textLight textXXS">
          <strong className="textBold">Serial Number:</strong>{" "}
          {asset.serial_number || "null"}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Operating System:</strong>{" "}
          {asset.operating_system?.name || asset.operating_system_id || "null"}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Product Key:</strong>{" "}
          {asset.product_key || "null"}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">MAC Address:</strong>{" "}
          {asset.mac_address || "null"}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Management IP:</strong>{" "}
          {asset.management_ip || "null"}
        </p>

        {/* Condition / Location / Department */}
        <p className="textLight textXXS">
          <strong className="textBold">Condition:</strong>{" "}
          {asset.asset_condition?.name || asset.asset_condition_id || "null"}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Location:</strong>{" "}
          {asset.asset_location?.name || asset.asset_location_id || "null"}
        </p>
        <p className="textLight textXXS">
          <strong className="textBold">Department:</strong>{" "}
          {asset.asset_department?.name || asset.asset_department_id || "null"}
        </p>

        {/* Retire Date */}
        <p className="textLight textXXS">
          <strong className="textBold">Retire Date:</strong>{" "}
          {asset.retire_date || "null"}
        </p>
      </CardLayout>
    </button>
  );
}

export default ITAssetCard;
