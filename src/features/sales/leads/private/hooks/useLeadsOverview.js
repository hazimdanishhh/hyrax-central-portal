import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { groupCount } from "../../../../../functions/dataTransform";
import { fetchLeadsOverview } from "../api/leadsOverview";

// ======================
// CONFIG
// ======================

const ACTIVE_STAGES = new Set([
  "DISCOVERY",
  "SAMPLE_TEST",
  "PROPOSAL",
  "NEGOTIATION",
]);

export function useLeadsOverview() {
  const query = useQuery({
    queryKey: ["sales_leads", "overview"],
    queryFn: fetchLeadsOverview,
    staleTime: 1000 * 60 * 5,
  });

  const data = query.data || [];

  // ======================
  // GROUPED DATA
  // ======================

  const stageData = useMemo(() => {
    return groupCount(data, "stage");
  }, [data]);

  const leadOwnerData = useMemo(() => {
    const filtered = data.filter((l) => l.lead_owner?.full_name);

    return [...groupCount(filtered, "lead_owner.full_name")]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data]);

  const sourceData = useMemo(() => {
    return groupCount(data, "lead_source.name");
  }, [data]);

  const topClientsData = useMemo(() => {
    const filtered = data.filter((l) => l.client?.name);

    return [...groupCount(filtered, "client.name")]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data]);

  // ======================
  // STATUS BREAKDOWN
  // ======================

  const statusBreakdownData = useMemo(() => {
    const grouped = {
      Active: 0,
      Won: 0,
      Lost: 0,
      Hold: 0,
      Cancelled: 0,
    };

    data.forEach((lead) => {
      if (lead.is_cancelled) {
        grouped.Cancelled += 1;
        return;
      }

      if (lead.is_on_hold) {
        grouped.Hold += 1;
        return;
      }

      if (lead.stage === "WON") {
        grouped.Won += 1;
        return;
      }

      if (lead.stage === "LOST") {
        grouped.Lost += 1;
        return;
      }

      grouped.Active += 1;
    });

    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value,
    }));
  }, [data]);

  // ======================
  // INSIGHTS
  // ======================

  const activeLeads = useMemo(() => {
    return data.filter(
      (lead) =>
        ACTIVE_STAGES.has(lead.stage) && !lead.is_cancelled && !lead.is_on_hold,
    );
  }, [data]);

  const wonLeads = useMemo(() => {
    return data.filter((lead) => lead.stage === "WON");
  }, [data]);

  const lostLeads = useMemo(() => {
    return data.filter((lead) => lead.stage === "LOST");
  }, [data]);

  const onHoldLeads = useMemo(() => {
    return data.filter((lead) => lead.is_on_hold);
  }, [data]);

  const cancelledLeads = useMemo(() => {
    return data.filter((lead) => lead.is_cancelled);
  }, [data]);

  // ======================
  // WIN / LOSS METRICS
  // ======================
  const winLossMetrics = useMemo(() => {
    const wonCount = wonLeads.length;
    const lostCount = lostLeads.length;
    const totalClosed = wonCount + lostCount;

    // Win Rate % (e.g., 62.5%) - Best for pie charts and KPI cards
    const winRate =
      totalClosed > 0 ? Number(((wonCount / totalClosed) * 100).toFixed(1)) : 0;

    // Win/Loss Ratio (e.g., 1.5 means 1.5 wins for every 1 loss)
    const winLossRatio =
      lostCount > 0 ? Number((wonCount / lostCount).toFixed(2)) : wonCount;

    return {
      winRate,
      winLossRatio,
      totalClosed,
    };
  }, [wonLeads, lostLeads]);

  // ======================
  // PIPELINE
  // ======================
  const pipelineDistributionData = useMemo(() => {
    return [
      {
        name: "Active",
        value: activeLeads.length,
      },
      {
        name: "Won",
        value: wonLeads.length,
      },
      {
        name: "Lost",
        value: lostLeads.length,
      },
      {
        name: "Hold",
        value: onHoldLeads.length,
      },
      {
        name: "Cancelled",
        value: cancelledLeads.length,
      },
    ];
  }, [activeLeads, wonLeads, lostLeads, onHoldLeads, cancelledLeads]);

  // ======================
  // REVENUE
  // ======================

  const totalPipelineValue = useMemo(() => {
    return activeLeads.reduce((sum, lead) => {
      return sum + Number(lead.expected_revenue || 0);
    }, 0);
  }, [activeLeads]);

  const weightedPipelineValue = useMemo(() => {
    return activeLeads.reduce((sum, lead) => {
      const revenue = Number(lead.expected_revenue || 0);
      const probability = Number(lead.close_probability || 0);

      return sum + revenue * (probability / 100);
    }, 0);
  }, [activeLeads]);

  const avgCloseProbability = useMemo(() => {
    if (!activeLeads.length) return 0;

    const total = activeLeads.reduce((sum, lead) => {
      return sum + Number(lead.close_probability || 0);
    }, 0);

    return Number((total / activeLeads.length).toFixed(1));
  }, [activeLeads]);

  // ======================
  // TREND LAYER
  // ======================
  const leadsTrendData = useMemo(() => {
    const grouped = {};

    data.forEach((lead) => {
      const date = new Date(lead.created_at);

      const key = date.toLocaleDateString("en-MY", {
        month: "short",
        year: "numeric",
      });

      if (!grouped[key]) {
        grouped[key] = {
          name: key,
          Total: 0,
          Won: 0,
          Lost: 0,
          Active: 0,
          Hold: 0,
        };
      }

      grouped[key].Total += 1;

      if (lead.stage === "WON") {
        grouped[key].Won += 1;
      } else if (lead.stage === "LOST") {
        grouped[key].Lost += 1;
      } else if (lead.is_on_hold) {
        grouped[key].Hold += 1;
      } else {
        grouped[key].Active += 1;
      }
    });

    return Object.values(grouped).reverse();
  }, [data]);

  // ======================
  // KPI LAYER
  // ======================

  const kpis = useMemo(() => {
    return {
      totalLeads: data.length,

      activeLeads: activeLeads.length,

      wonLeads: wonLeads.length,

      lostLeads: lostLeads.length,

      onHoldLeads: onHoldLeads.length,

      cancelledLeads: cancelledLeads.length,

      winRate: winLossMetrics.winRate,
      winLossRatio: winLossMetrics.winLossRatio,
      totalClosed: winLossMetrics.totalClosed,

      winRateFormatted: new Intl.NumberFormat("en-MY", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(winLossMetrics.winRate / 100),

      totalPipelineValue,

      weightedPipelineValue,

      avgCloseProbability,

      totalPipelineValueFormatted: new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        maximumFractionDigits: 0,
      }).format(totalPipelineValue),
    };
  }, [
    data.length,
    activeLeads,
    wonLeads,
    lostLeads,
    onHoldLeads,
    cancelledLeads,
    winLossMetrics,
    totalPipelineValue,
    weightedPipelineValue,
    avgCloseProbability,
  ]);

  // ======================
  // FINAL EXPORT
  // ======================

  return {
    ...query,

    // grouped
    stageData,
    leadOwnerData,
    sourceData,
    topClientsData,
    statusBreakdownData,

    // insights
    activeLeads,
    wonLeads,
    lostLeads,
    onHoldLeads,
    cancelledLeads,

    // advanced
    pipelineDistributionData,
    leadsTrendData,

    // KPI
    kpis,
  };
}
