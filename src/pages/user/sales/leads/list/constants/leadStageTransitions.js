// constants/leadStageTransitions.js

export const LEAD_STAGE_TRANSITIONS = {
  DISCOVERY: ["SAMPLE_TEST", "PROPOSAL"],

  SAMPLE_TEST: ["PROPOSAL"],

  PROPOSAL: ["NEGOTIATION"],

  NEGOTIATION: ["WON", "LOST"],

  WON: [],

  LOST: [],
};

export const LEAD_STAGE_LABELS = {
  DISCOVERY: "Discovery",
  SAMPLE_TEST: "Require Sample Test",
  PROPOSAL: "Ready for Proposal",
  NEGOTIATION: "Quotation Sent",
  WON: "Mark as Won",
  LOST: "Mark as Lost",
};
