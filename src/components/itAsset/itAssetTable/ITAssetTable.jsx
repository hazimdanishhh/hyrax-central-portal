import "./ITAssetTable.scss";
import { Desktop, WindowsLogo, LinuxLogo } from "phosphor-react";
import { itAssetTableColumns } from "../../../data/itAssetTableColumns";
import StatusBadge from "../../status/statusBadge/StatusBadge";

function ITAssetTable({ assets = [] }) {
  return (
    <div className="itAssetTableWrapper">
      <table className="itAssetTable">
        <thead>
          <tr>
            <th>Type / OS</th>
            {itAssetTableColumns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              {/* ICON COLUMN */}
              <td className="iconCell">
                {asset.asset_subcategory?.name
                  ?.toLowerCase()
                  .includes("desktop") && <Desktop size={20} />}

                {asset.operating_system?.name
                  ?.toLowerCase()
                  .includes("windows") && <WindowsLogo size={20} />}

                {asset.operating_system?.name
                  ?.toLowerCase()
                  .includes("linux") && <LinuxLogo size={20} />}
              </td>

              {/* DATA COLUMNS */}
              <td>
                <input
                  value={asset.asset_name || ""}
                  size={(asset.asset_name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={asset.asset_code || ""}
                  size={(asset.asset_code || "").length || 1}
                />
              </td>

              <td>
                <input
                  value={
                    asset.asset_status?.name || asset.asset_status_id || "null"
                  }
                />
              </td>

              <td>
                <input
                  disabled
                  value={
                    asset.asset_category?.name || asset.asset_category_id || ""
                  }
                  size={(asset.asset_category?.name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={
                    asset.asset_subcategory?.name ||
                    asset.asset_subcategory_id ||
                    ""
                  }
                  size={(asset.asset_subcategory?.name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={
                    asset.asset_user?.full_name || asset.asset_user_id || ""
                  }
                  size={(asset.asset_user?.full_name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={
                    asset.manufacturer?.name || asset.manufacturer_id || ""
                  }
                  size={(asset.manufacturer?.name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={asset.model?.name || asset.model_id || ""}
                  size={(asset.model?.name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={asset.serial_number || ""}
                  size={(asset.serial_number || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={
                    asset.operating_system?.name ||
                    asset.operating_system_id ||
                    ""
                  }
                  size={(asset.operating_system?.name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={asset.mdm_status || ""}
                  size={(asset.mdm_status || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={
                    asset.asset_location?.name || asset.asset_location_id || ""
                  }
                  size={(asset.asset_location?.name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={
                    asset.asset_department?.name ||
                    asset.asset_department_id ||
                    ""
                  }
                  size={(asset.asset_department?.name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={
                    asset.asset_condition?.name ||
                    asset.asset_condition_id ||
                    ""
                  }
                  size={(asset.asset_condition?.name || "").length || 1}
                />
              </td>

              <td>
                <input
                  disabled
                  value={asset.retire_date || ""}
                  size={(asset.retire_date || "").length || 1}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ITAssetTable;
