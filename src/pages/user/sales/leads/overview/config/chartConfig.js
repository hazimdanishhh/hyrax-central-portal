import {
  BLUE_COLOR,
  GREEN_COLOR,
} from "../../../../../../components/chartCard/chartColors";

export const getChartConfig = (leaderboardView) => {
  switch (leaderboardView) {
    case "productivity":
      return {
        subtitle: "Input vs. Output (RM)",
        bars: [
          {
            dataKey: "pipeline_generated",
            name: "Pipeline Generated",
            color: BLUE_COLOR,
          },
          { dataKey: "won_actual", name: "Won Revenue", color: GREEN_COLOR },
        ],
      };
    case "accuracy":
      return {
        subtitle: "Forecast vs. Reality (RM)",
        bars: [
          { dataKey: "won_expected", name: "Expected Won", color: "#94a3b8" }, // Slate Gray
          { dataKey: "won_actual", name: "Actual Won", color: GREEN_COLOR },
        ],
      };
    case "execution":
      return {
        subtitle: "Won vs. Lost (RM)",
        bars: [
          { dataKey: "won_actual", name: "Won Revenue", color: GREEN_COLOR },
          { dataKey: "lost_revenue", name: "Lost Revenue", color: "#ef4444" }, // Red
        ],
      };
    default:
      return { subtitle: "", bars: [] };
  }
};
