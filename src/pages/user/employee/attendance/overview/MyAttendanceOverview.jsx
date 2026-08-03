import { useRef } from "react";
import {
  ChartLineUpIcon,
  ChartPieSliceIcon,
  GaugeIcon,
} from "@phosphor-icons/react";
import CardLayout from "@/components/cardLayout/CardLayout";
import ChartCard from "@/components/chartCard/ChartCard";
import LineChartRenderer from "@/components/chartCard/LineChartRenderer";
import PieChartRenderer from "@/components/chartCard/PieChartRenderer";
import {
  ATTENDANCE_FLAG_COLORS,
  BLUE_COLOR,
  GREEN_COLOR,
  WORK_CHANNEL_COLORS,
} from "@/components/chartCard/chartColors";
import NoResult from "@/components/crud/noResult/NoResult";
import OverviewCards from "@/components/crud/overviewCards/OverviewCards";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import ExportActions from "@/components/exportActions/ExportActions";
import { useEmployee } from "@/context/EmployeeContext";
import useDashboardQuery from "@/hooks/useDashboardQuery";
import { fetchMyAttendanceDashboard } from "@/features/employee/attendance/private/api/myAttendanceService";
import { getMyAttendanceOverviewConfig } from "./overviewConfig";

/**
 * My Attendance Overview -- reuses get_attendance_dashboard unchanged
 * (p_employee_id already scopes every CTE). No employee/department picker
 * (scope is always self); Departments chart and the Needs Attention
 * leaderboards are dropped (meaningless scoped to one person).
 */
export default function MyAttendanceOverview() {
  const dashboardRef = useRef(null);
  const { employee } = useEmployee();

  const {
    data: dashboard,
    filters,
    setFilters,
    isLoading: dashboardLoading,
    isFetching: dashboardFetching,
    error: dashboardError,
  } = useDashboardQuery({
    queryKey: "my_attendance_dashboard",
    queryFn: fetchMyAttendanceDashboard(employee?.id),
    enabled: Boolean(employee?.id),
  });

  const isLoading = dashboardLoading;
  const isFetching = dashboardFetching;
  const isError = dashboardError;

  const kpis = dashboard?.kpis ?? {};
  const isPeriodFiltered = Boolean(filters.startDate) && Boolean(filters.endDate);
  const overviewItems = getMyAttendanceOverviewConfig(kpis, isPeriodFiltered, filters);

  const chartToday = new Date().toISOString().slice(0, 10);
  const chartMonthStart = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-01`;
  const chartPeriodFilter = {
    startDate: filters.startDate || chartMonthStart,
    endDate: filters.endDate || chartToday,
  };

  const hrFlagBreakdownData = dashboard?.hrFlagBreakdownData ?? [];
  const workChannelMixData = dashboard?.workChannelMixData ?? [];

  const dailyAttendanceTrendData =
    dashboard?.dailyAttendanceTrendData?.map((d) => ({
      name: d.period,
      "Attendance Rate": d.roster_count
        ? Math.round((d.present_count / d.roster_count) * 100)
        : 0,
    })) ?? [];

  const hoursWorkedTrendData =
    dashboard?.hoursWorkedTrendData?.map((d) => ({
      name: d.period,
      "Avg Hours": d.avg_hours ?? 0,
    })) ?? [];

  return (
    <>
      <SearchFilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={[]}
        enableDateRange
        disableSearch
        isLoading={isLoading}
        isError={isError}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.8rem",
        }}
      >
        <ExportActions
          targetRef={dashboardRef}
          fileName="My_Attendance_Overview_Report"
          reportTitle="My Attendance Overview"
          logoUrl="/logos/logo.png"
          subtitle={
            filters.startDate && filters.endDate
              ? `${filters.startDate} to ${filters.endDate}`
              : "All Time"
          }
        />
      </div>

      <div
        ref={dashboardRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
        }}
      >
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : isError ? (
          <CardLayout style="cardLayoutFlexFull">
            <NoResult title="Error loading attendance overview." />
          </CardLayout>
        ) : (
          <>
            <div className="pdfOverviewSection">
              <div style={{ justifyContent: "start", textAlign: "start" }}>
                <div style={{ marginBottom: "1rem" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
                  >
                    <GaugeIcon size={24} />
                    <h2 className="textL textBold">Attendance KPIs</h2>
                  </div>
                  <p className="textXS textLight">
                    {isPeriodFiltered
                      ? "Your attendance for the selected period."
                      : "Your attendance today and how it's trending this period."}
                  </p>
                </div>

                <OverviewCards items={overviewItems} />
              </div>
            </div>

            <div className="pdfOverviewSection">
              <div style={{ justifyContent: "start", textAlign: "start" }}>
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
                  >
                    <ChartLineUpIcon size={24} />
                    <h2 className="textL textBold">Attendance Trends</h2>
                  </div>
                  <p className="textXS textLight">
                    Your daily attendance and average hours worked over the
                    selected period.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Daily Attendance"
                    subtitle="Present, By Day"
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={dailyAttendanceTrendData}
                      lines={[{ dataKey: "Attendance Rate", color: BLUE_COLOR }]}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Hours Worked"
                    subtitle="Hours Worked, By Day"
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={hoursWorkedTrendData}
                      lines={[{ dataKey: "Avg Hours", color: GREEN_COLOR }]}
                    />
                  </ChartCard>
                </CardLayout>
              </div>
            </div>

            <div className="pdfOverviewSection">
              <div style={{ justifyContent: "start", textAlign: "start" }}>
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
                  >
                    <ChartPieSliceIcon size={24} />
                    <h2 className="textL textBold">Work Pattern</h2>
                  </div>
                  <p className="textXS textLight">
                    Your status composition and hardware-scan vs app/remote
                    channel mix, this period.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Status Breakdown"
                    subtitle="By Record, This Period (Excludes Weekend / Rest Day)"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{ workingDayOnly: "true", ...chartPeriodFilter }}
                  >
                    <PieChartRenderer
                      data={hrFlagBreakdownData}
                      mode="semantic"
                      colorMap={ATTENDANCE_FLAG_COLORS}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Work Channel Mix"
                    subtitle="Office (Hardware Scan) vs Remote (App), This Period"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{ workingDayOnly: "true", ...chartPeriodFilter }}
                  >
                    <PieChartRenderer
                      data={workChannelMixData}
                      mode="semantic"
                      colorMap={WORK_CHANNEL_COLORS}
                    />
                  </ChartCard>
                </CardLayout>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
