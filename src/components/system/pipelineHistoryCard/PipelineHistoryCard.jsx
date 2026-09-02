import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { formatDateTime } from "../../../functions/formatDate";
import IconCard from "../../iconCard/IconCard";
import StatusBox from "../../status/statusBox/StatusBox";

export default function PipelineHistoryCard({ data }) {
  return (
    <div className="generalCard cardPaddingSmall">
      <div className="pipelineCardHeader">
        <div className="pipelineCardHeaderRight">
          <p className="textS textBold">{data.pipeline_name}</p>
          {data.rows_extracted !== null && (
            <p className="textXS">{data.rows_extracted} Rows</p>
          )}
        </div>

        <div className="pipelineCardHeaderRight">
          <IconCard
            icon={ClockCounterClockwiseIcon}
            name={`${formatDateTime(data.run_at)}`}
            style="blue textXXS textBold"
          />
          <IconCard
            icon={ClockCounterClockwiseIcon}
            name={`${data.duration_seconds}s`}
            style="yellow textXXS textBold"
          />

          <StatusBox
            status={data.status}
            type={data.status === "success" ? "green" : "red"}
          />
        </div>
      </div>

      {data.error_message && (
        <p className="pipelineError textBold textXXS">
          Error: {data.error_message}
        </p>
      )}
    </div>
  );
}
