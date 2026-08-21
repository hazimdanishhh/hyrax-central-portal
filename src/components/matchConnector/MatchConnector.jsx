import "./MatchConnector.scss";

// A small "this section is a different, related record" marker -- adapts
// LeadStage.jsx's vertical circle+line technique (sibling divs, not
// ::before/::after), but as a single relationship marker rather than a
// multi-node progress/stage tracker, so it's themed as a plain neutral
// "link" indicator instead of LeadStage's win/loss/on-hold color palette.
// Render one instance immediately before each "Matched ..." CardLayout
// (paired with the matchedSection modifier class, src/styles/index.scss) to
// visually separate a record's own details from a different record it's
// linked to.
export default function MatchConnector({ label, icon: Icon }) {
  return (
    <div className="matchConnector">
      <div className="matchConnectorTrack">
        <div className="matchConnectorLine" />
        <div className="matchConnectorNode" />
      </div>

      <div className="matchConnectorLabel textBold textXS">
        {Icon && <Icon size={16} />}
        <span>{label}</span>
      </div>
    </div>
  );
}
