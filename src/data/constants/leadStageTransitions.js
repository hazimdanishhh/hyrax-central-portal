// constants/leadStageTransitions.js

export const LEAD_STAGE_TRANSITIONS = {
  DISCOVERY: ["SAMPLE_TEST", "LOST"],

  SAMPLE_TEST: ["PROPOSAL", "LOST"],

  PROPOSAL: ["NEGOTIATION", "LOST"],

  NEGOTIATION: ["WON", "LOST"],

  WON: [],

  LOST: [],
};

export const LEAD_STAGE_LABELS = {
  DISCOVERY: "Discovery",
  SAMPLE_TEST: "Sample Test",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Mark as Won",
  LOST: "Mark as Lost",
};
