import "./LeadStage.scss";

export const PIPELINE_STAGES = [
  "DISCOVERY",
  "SAMPLE_TEST",
  "PROPOSAL",
  "NEGOTIATION",
];

function LeadStage({ selectedRow, list, vertical }) {
  const currentStage = selectedRow?.stage;

  const currentStageIndex = PIPELINE_STAGES.indexOf(currentStage);

  const isWon = currentStage === "WON";
  const isLost = currentStage === "LOST";

  /**
   * Enterprise priority hierarchy:
   *
   * CANCELLED > LOST > ON HOLD > WON > ACTIVE
   */
  const getStageState = () => {
    if (selectedRow?.is_cancelled) return "cancelled";
    if (isLost) return "lost";
    if (selectedRow?.is_on_hold) return "onHold";
    if (isWon) return "won";

    return "active";
  };

  const stageState = getStageState();

  return (
    <div
      className={`leadSidebarStageContainer ${list ? "list" : ""} ${vertical ? "vertical" : ""}`}
    >
      {/* MAIN PIPELINE */}
      {PIPELINE_STAGES.map((stage, index) => {
        const isActive = index <= currentStageIndex || isWon || isLost;

        return (
          <div
            key={stage}
            className={vertical ? "leadSidebarStageWrapper" : ""}
          >
            <div
              className={`leadSidebarStageCircleContainer ${vertical ? "vertical" : ""}`}
            >
              <div
                className={`leadSidebarStageCircle ${isActive ? stageState : ""} ${vertical ? "vertical" : ""}`}
              />

              {index !== PIPELINE_STAGES.length && (
                <div
                  className={`leadSidebarStageLine ${isActive ? stageState : ""} ${vertical ? "vertical" : ""}`}
                />
              )}
            </div>

            {vertical && (
              <div className="leadSidebarStageDetails">
                <p
                  className={`leadSidebarStageLabel ${isActive ? stageState : ""}`}
                >
                  {PIPELINE_STAGES[index]}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* FINAL OUTCOME */}
      <div className={vertical ? "leadSidebarStageWrapper" : ""}>
        <div
          className={`leadSidebarFinalStageContainer ${vertical ? "vertical" : ""}`}
        >
          <div
            className={` leadSidebarStageCircle ${isWon ? "won" : ""} ${isLost ? "lost" : ""}`}
          />
        </div>

        {vertical && (
          <div className="leadSidebarStageDetails">
            <p
              className={`leadSidebarStageLabel ${isWon ? "won" : ""} ${isLost ? "lost" : ""}`}
            >
              {isWon ? "WON" : isLost ? "LOST" : "RESULT"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeadStage;
