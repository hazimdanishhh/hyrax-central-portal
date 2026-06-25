import { BLUE_COLOR, GREEN_COLOR } from "../../../chartCard/chartColors";
import EmployeeImage from "../../../employees/employeeImage/EmployeeImage";
import "./LeadsScoreCard.scss";

export default function ScorecardList({ data = [] }) {
  if (!data || data.length === 0) return null;

  const formatRM = (val) => `RM ${Math.round(val).toLocaleString()}`;

  // Helper to get initials for the modern avatar
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.split(" ");
    return parts.length > 1
      ? parts[0][0] + parts[1][0]
      : parts[0].substring(0, 2);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {data.map((row, idx) => {
        const {
          rep_name,
          actual_revenue,
          target_revenue,
          attainment_percentage,
        } = row;

        // Progress bar logic
        const progressRaw =
          target_revenue > 0 ? (actual_revenue / target_revenue) * 100 : 0;
        const progressWidth = Math.min(progressRaw, 100); // Cap visual bar at 100%
        const isTargetMet = attainment_percentage >= 100;
        const barColor = isTargetMet ? GREEN_COLOR : BLUE_COLOR;

        return (
          <div key={idx} className="generalCard leadsScoreCard">
            {/* 1. AVATAR & NAME */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flex: "1 1 200px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                {getInitials(rep_name).toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="textBold textS">{rep_name}</span>
              </div>
            </div>

            {/* 2. QUOTA PROGRESS BAR */}
            <div className="quotaSegment">
              <div className="quotaText textXXXS">
                <span>{attainment_percentage}% Attainment</span>
                <span>Target: {formatRM(target_revenue)}</span>
              </div>

              {/* The Track */}
              <div className="quotaBarContainer">
                {/* The Fill */}
                <div
                  className="quotaBarFill"
                  style={{
                    width: `${progressWidth}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>

            {/* 3. ACTUAL WON NUMBER */}
            <div className="actualWonSegment">
              <span className="textXS textLight">Actual Won</span>
              <span
                className="textL textBold"
                style={{ color: isTargetMet ? GREEN_COLOR : "inherit" }}
              >
                {formatRM(actual_revenue)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
