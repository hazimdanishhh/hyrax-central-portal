import "./LeadStage.scss";

const PIPELINE_STAGES = ["DISCOVERY", "SAMPLE_TEST", "PROPOSAL", "NEGOTIATION"];

function LeadStage({ selectedRow }) {
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
    <div className="leadSidebarStageContainer">
      {/* MAIN PIPELINE */}
      {PIPELINE_STAGES.map((stage, index) => {
        const isActive = index <= currentStageIndex || isWon || isLost;

        return (
          <div className="leadSidebarStageCircleContainer" key={stage}>
            <div
              className={`
                  leadSidebarStageCircle
                  ${isActive ? stageState : ""}
                `}
            />

            {index !== PIPELINE_STAGES.length && (
              <div
                className={`
                    leadSidebarStageLine
                    ${isActive ? stageState : ""}
                  `}
              />
            )}
          </div>
        );
      })}

      {/* FINAL OUTCOME */}
      <div className="leadSidebarFinalStageContainer">
        <div
          className={`
              leadSidebarStageCircle
              ${isWon ? "won" : ""}
              ${isLost ? "lost" : ""}
            `}
        />
      </div>
    </div>
  );
}

export default LeadStage;
