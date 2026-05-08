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
  EMPLOYMENT_TYPE_COLORS,
  GREEN_COLOR,
  RED_COLOR,
  RISK_COLORS,
  STATUS_COLORS,
  UTILIZATION_COLORS,
  GENDER_COLORS,
} from "../../../../../components/chartCard/chartColors";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import StackedBarRenderer from "../../../../../components/chartCard/StackedBarRenderer";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import { getEmployeesOverviewConfig } from "./overviewConfig";
import { useEmployeesOverview } from "../../../../../features/hr/employees/private/hooks/useEmployeesOverview";

export default function EmployeeOverview() {
  // ==============
  // ANALYTICS
  // ==============
  const {
    // grouped
    departmentData,
    statusData,
    workforceCompositionData,
    nationalityData,
    identificationTypeData,
    terminationData,
    managerData,
    employmentTypeData,
    genderData,

    // insights
    employeesWithoutManager,
    employeesWithManager,
    activeEmployees,
    inactiveEmployees,
    terminatedEmployees,
    employeesMissingProfile,

    // advanced
    teamSizeData,
    fullTeamSizeData,
    managementCoverageData,
    topDepartments,

    // KPIs
    kpis,
    isLoading: overviewLoading,
  } = useEmployeesOverview();

  const overviewItems = getEmployeesOverviewConfig(kpis);

  return (
    <>
      {overviewLoading ? (
        <CardLayout style="cardLayoutFlexFull">
          <LoadingIcon />
        </CardLayout>
      ) : (
        <>
          <OverviewCards items={overviewItems} />

          <CardLayout style="cardLayout2">
            <ChartCard style="cardGapSmall" title="Departments">
              <BarChartRenderer data={departmentData} colorMap={GREEN_COLOR} />
            </ChartCard>

            <ChartCard title="Workforce Status" style="cardGapSmall">
              <PieChartRenderer
                mode="semantic"
                data={statusData}
                colorMap={STATUS_COLORS}
                centerLabel={kpis.activeEmployees}
                centerSubLabel="Active"
              />
            </ChartCard>

            <ChartCard title="Top Managers (Team Size)" style="cardGapSmall">
              <BarChartRenderer data={teamSizeData} colorMap={BLUE_COLOR} />
            </ChartCard>

            <ChartCard title="Management Coverage" style="cardGapSmall">
              <StackedBarRenderer
                data={managementCoverageData}
                colorMap={UTILIZATION_COLORS}
              />
            </ChartCard>

            <ChartCard title="Employment Type" style="cardGapSmall">
              <PieChartRenderer
                data={workforceCompositionData}
                mode="semantic"
                colorMap={EMPLOYMENT_TYPE_COLORS}
              />
            </ChartCard>

            <ChartCard title="Gender Distribution" style="cardGapSmall">
              <PieChartRenderer
                data={genderData}
                mode="semantic"
                colorMap={GENDER_COLORS}
              />
            </ChartCard>
          </CardLayout>
        </>
      )}
    </>
  );
}
