// src/pages/user/sales/reports/tabs/MeetingBrief.jsx
//
// ⚠ PARKED 2026-10-23 -- NOT DEPLOYED, NOT RENDERED. Kept for later. The
// Summary tab's <MeetingBrief/> is commented out, sales_report_briefs.sql is
// not run, and the generate-sales-meeting-brief edge function is not
// deployed. Planned before turning it on (docs/portal/DASHBOARD-ROADMAP.md
// §2.1): make it reusable for every report (one report_briefs table keyed
// by report type, a figures builder + access check per report) and feed it
// every tab's figures, not only the four headline RPCs it reads now.

import ReactMarkdown from "react-markdown";
import { SparkleIcon } from "@phosphor-icons/react";
import Button from "../../../../../components/buttons/button/Button";
import { formatDateTime } from "../../../../../functions/formatDate";
import { useMeetingBrief } from "../../../../../features/sales/reports/private/hooks/useMeetingBrief";
import ReportSection from "./ReportSection";
import "../../../../../components/aiSummary/AISummary.scss";

/**
 * Meeting Brief -- the first section of Summary (R1, answer first): an AI
 * summary of the report for this period and salesperson, in three parts
 * (What happened / Why / What's coming and the risks).
 *
 * Written on request, not on every page load (each one is a model call),
 * by the generate-sales-meeting-brief edge function, which reads the same
 * tab RPCs as the page with the user's own session and keeps the figures it
 * used. Stored in sales_report_briefs, readable only by people who could
 * open this report for that salesperson. A brief is a summary of the
 * figures below it, never a replacement for them: the generated time and
 * the AI label stay on it.
 */
export default function MeetingBrief({ filters, period }) {
  const { data: brief, isLoading, error, generate } = useMeetingBrief({
    startDate: period.startDate,
    endDate: period.endDate,
    owner: filters.owner || null,
  });

  const action = (
    <Button
      onClick={() => generate.mutate()}
      disabled={generate.isPending}
      style="textBold textXS button buttonType5 aiButton"
      name={
        generate.isPending
          ? "Writing…"
          : brief
            ? "Rewrite with today's figures"
            : "Write the brief"
      }
      icon2={SparkleIcon}
      weight="fill"
    />
  );

  return (
    <ReportSection
      icon={SparkleIcon}
      title="Meeting Brief"
      description={`${period.title}${
        filters.owner ? ", for the selected salesperson" : ", all salespeople"
      } — written by AI from the figures on these tabs. Check it against them.`}
    >
      <div className="generalCard AISummaryCard" style={{ textAlign: "start" }}>
        {isLoading ? (
          <p className="textS textLight">Loading the brief…</p>
        ) : error ? (
          <p className="textS textLight">The brief could not be loaded.</p>
        ) : brief ? (
          <>
            <div className="AISummaryHeaderContainer">
              <span className="textXXXS textLight">
                <span className="textBold">Written:</span>{" "}
                {formatDateTime(brief.created_at)}
                {brief.model ? ` · ${brief.model}` : ""}
              </span>
              <span data-html2canvas-ignore="true">{action}</span>
            </div>
            <div className="textS AISummaryBody">
              <ReactMarkdown>{brief.brief_text}</ReactMarkdown>
            </div>
          </>
        ) : (
          <div className="AISummaryHeaderContainer">
            <p className="textS textLight">
              No brief for this period yet. It takes a few seconds and uses the
              figures on these tabs.
            </p>
            <span data-html2canvas-ignore="true">{action}</span>
          </div>
        )}
      </div>
    </ReportSection>
  );
}
