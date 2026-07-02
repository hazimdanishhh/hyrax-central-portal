import { SparkleIcon } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import { useAiSummary } from "../../features/aiSummary/hooks/useAiSummary";
import "./AISummary.scss";

export default function AISummary({ type = "leads", filters = {} }) {
  // Extract the active dates from the dashboard filters
  const startDate = filters?.startDate || null;
  const endDate = filters?.endDate || null;

  // Pass the dates into the hook to ensure it fetches the matching summary
  const {
    data: summary,
    isLoading,
    error,
  } = useAiSummary(type, startDate, endDate);

  if (isLoading) {
    return (
      <div className="generalCard AISummaryCard">
        <p className="textS textLight">Generating AI Briefing...</p>
      </div>
    );
  }

  // Fail gracefully if there's no data yet or an error occurred
  if (error || !summary) return null;

  return (
    <div
      className="generalCard AISummaryCard"
      style={{
        textAlign: "start",
      }}
    >
      <div className="AISummaryHeaderContainer">
        <div className="AISummaryHeader">
          <SparkleIcon weight="fill" size={24} />
          <h2 className="textL textBold">AI Executive Briefing</h2>
        </div>

        <div>
          <div className="textXXXS textLight">
            <span className="textBold">Period: </span>
            {summary.period_start_formatted && summary.period_end_formatted
              ? `${summary.period_start_formatted} to ${summary.period_end_formatted}`
              : "All Time"}
          </div>
          <div className="textXXXS textLight">
            <span className="textBold">Generated: </span>
            {summary.created_at}
          </div>
        </div>
      </div>

      {/* Replaced <p> with a <div> wrapper to avoid invalid HTML nesting */}
      <div className="textS AISummaryBody">
        <ReactMarkdown>{summary.summary_text}</ReactMarkdown>
      </div>
    </div>
  );
}
