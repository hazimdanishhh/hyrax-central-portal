import React, { useMemo } from "react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import {
  ChartDonutIcon,
  ChartPieSliceIcon,
  CheckCircleIcon,
  DesktopIcon,
  UserMinusIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import {
  BLUE_COLOR,
  CONDITION_COLORS,
  GREEN_COLOR,
  RED_COLOR,
  RISK_COLORS,
  STATUS_COLORS,
  UTILIZATION_COLORS,
} from "../../../../../components/chartCard/chartColors";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import { useITAssetsOverview } from "../../../../../hooks/itAssets/useITAssetsOverview";
import ITAssetsPageLayout from "../ITAssetsPageLayout";
import StackedBarRenderer from "../../../../../components/chartCard/StackedBarRenderer";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";

function ITAssetOverview() {
  // ==============
  // ANALYTICS
  // ==============
  const {
    // grouped charts
    categoryData,
    statusData,
    subcategoryData,
    departmentData,
    conditionData,
    osData,

    // insight charts
    riskData,
    utilizationData,

    // lists (for tables / drilldowns)
    riskAssets,
    unassignedAssets,
    assignedAssets,

    // KPIs
    kpis,
    isLoading: overviewLoading,
  } = useITAssetsOverview();

  return (
    <>
      {overviewLoading ? (
        <CardLayout style="cardLayoutFlexFull">
          <LoadingIcon />
        </CardLayout>
      ) : (
        <CardLayout>
          <CardLayout style="cardLayout2">
            <ChartCard
              style="cardGapSmall"
              icon={ChartPieSliceIcon}
              title="Assets by Category"
            >
              <PieChartRenderer
                data={categoryData}
                showLegend={false}
                centerLabel="total"
                centerSubLabel="Total Assets"
              />
            </ChartCard>

            <CardLayout>
              <ChartCard
                title="Asset Status"
                icon={ChartDonutIcon}
                style="cardGapSmall"
              >
                <StackedBarRenderer
                  data={statusData}
                  colorMap={STATUS_COLORS}
                />
              </ChartCard>
              <ChartCard title="Asset Condition" style="cardGapSmall">
                <StackedBarRenderer
                  data={conditionData}
                  colorMap={CONDITION_COLORS}
                />
              </ChartCard>
            </CardLayout>
          </CardLayout>

          <CardLayout style="cardLayout2">
            <ChartCard style="cardGapSmall">
              <PieChartRenderer
                data={riskData}
                mode="semantic"
                colorMap={RISK_COLORS}
                centerLabel={kpis.riskAssets}
                centerSubLabel="At Risk"
              />
            </ChartCard>

            <ChartCard style="cardGapSmall">
              <PieChartRenderer
                data={utilizationData}
                mode="semantic"
                colorMap={UTILIZATION_COLORS}
                centerLabel={kpis.assignedAssets}
                centerSubLabel="Assigned"
              />
            </ChartCard>

            <ChartCard title="Operating Systems">
              <BarChartRenderer data={osData} colorMap={GREEN_COLOR} />
            </ChartCard>

            <ChartCard title="By Department">
              <BarChartRenderer data={departmentData} colorMap={BLUE_COLOR} />
            </ChartCard>
          </CardLayout>
        </CardLayout>
      )}
    </>
  );
}

export default ITAssetOverview;
