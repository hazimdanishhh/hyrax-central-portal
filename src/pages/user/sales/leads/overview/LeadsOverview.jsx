import {
  ChartDonutIcon,
  ChartPieSliceIcon,
  CurrencyDollarIcon,
  FunnelIcon,
  HandshakeIcon,
  WarningIcon,
} from "@phosphor-icons/react";

import { getLeadsOverviewConfig } from "./overviewConfig";
import { useLeadsOverview } from "../../../../../features/sales/leads/private/hooks/useLeadsOverview";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  LEAD_STAGE_COLORS,
  LEAD_STATUS_COLORS,
  LEAD_UTILIZATION_COLORS,
  RED_COLOR,
  UTILIZATION_COLORS,
  YELLOW_COLOR,
} from "../../../../../components/chartCard/chartColors";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import StackedBarRenderer from "../../../../../components/chartCard/StackedBarRenderer";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import { LEAD_TREND_COLORS } from "../../../../../components/chartCard/chartColors";

export default function LeadsOverview() {
  const {
    // grouped
    stageData,
    leadOwnerData,
    sourceData,
    statusBreakdownData,
    topClientsData,

    // advanced
    pipelineDistributionData,
    leadsTrendData,

    // insights
    activeLeads,
    wonLeads,
    lostLeads,
    onHoldLeads,

    // KPI
    kpis,
    isLoading: overviewLoading,
  } = useLeadsOverview();

  const overviewItems = getLeadsOverviewConfig(kpis);

  return (
    <>
      {overviewLoading ? (
        <CardLayout style="cardLayoutFlexFull">
          <LoadingIcon />
        </CardLayout>
      ) : (
        <>
          <OverviewCards items={overviewItems} />

          <ChartCard title="Lead Trends Over Time" style="cardGapSmall">
            <LineChartRenderer
              data={leadsTrendData}
              lines={[
                {
                  dataKey: "Total",
                  color: LEAD_TREND_COLORS.Total,
                },
                {
                  dataKey: "Won",
                  color: LEAD_TREND_COLORS.Won,
                },
                {
                  dataKey: "Lost",
                  color: LEAD_TREND_COLORS.Lost,
                },
                {
                  dataKey: "Active",
                  color: LEAD_TREND_COLORS.Active,
                },
              ]}
            />
          </ChartCard>

          <CardLayout style="cardLayout2">
            <ChartCard title="Lead Stages" style="cardGapSmall">
              <PieChartRenderer
                data={stageData}
                mode="semantic"
                colorMap={LEAD_STAGE_COLORS}
                centerLabel={kpis.activeLeads}
                centerSubLabel="Active Leads"
              />
            </ChartCard>

            <ChartCard title="Pipeline Distribution" style="cardGapSmall">
              <StackedBarRenderer
                data={pipelineDistributionData}
                colorMap={LEAD_UTILIZATION_COLORS}
              />
            </ChartCard>

            <ChartCard title="Top Lead Owners" style="cardGapSmall">
              <BarChartRenderer data={leadOwnerData} colorMap={BLUE_COLOR} />
            </ChartCard>

            <ChartCard title="Lead Sources" style="cardGapSmall">
              <BarChartRenderer data={sourceData} colorMap={YELLOW_COLOR} />
            </ChartCard>

            <ChartCard title="Top Clients" style="cardGapSmall">
              <BarChartRenderer data={topClientsData} colorMap={GREEN_COLOR} />
            </ChartCard>

            {/* <ChartCard title="Lead Status Breakdown" style="cardGapSmall">
              <PieChartRenderer
                data={statusBreakdownData}
                mode="semantic"
                colorMap={LEAD_STATUS_COLORS}
              />
            </ChartCard> */}
          </CardLayout>
        </>
      )}
    </>
  );
}
