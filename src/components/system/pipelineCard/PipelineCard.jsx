import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { formatDateTime } from "../../../functions/formatDate";
import IconCard from "../../iconCard/IconCard";
import StatusBox from "../../status/statusBox/StatusBox";
import "./PipelineCard.scss";

export default function PipelineCard({ data }) {
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
            name={`Last Run: ${formatDateTime(data.last_run_at)}`}
            style="blue textXXS textBold"
          />
          <IconCard
            icon={ClockCounterClockwiseIcon}
            name={`Watermark: ${formatDateTime(data.last_watermark)}`}
            style="yellow textXXS textBold"
          />
          <StatusBox
            status={data.last_run_status}
            type={data.last_run_status === "success" ? "green" : "red"}
          />
        </div>
      </div>
    </div>
  );
}
