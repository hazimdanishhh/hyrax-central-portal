export const stageTabsConfig = (currentStage, isCancelled, isOnHold) => [
  {
    label: "ALL",
    to: "#",
    themeType: "",
    isActive: !currentStage && !isCancelled && !isOnHold,
  },
  {
    label: "DISCOVERY",
    to: "?stage=DISCOVERY&onHold=false&cancelled=false",
    themeType: "blue",
    isActive: currentStage === "DISCOVERY" && !isCancelled && !isOnHold,
  },
  {
    label: "SAMPLE TEST",
    to: "?stage=SAMPLE_TEST&onHold=false&cancelled=false",
    themeType: "blue",
    isActive: currentStage === "SAMPLE_TEST" && !isCancelled && !isOnHold,
  },
  {
    label: "PROPOSAL",
    to: "?stage=PROPOSAL&onHold=false&cancelled=false",
    themeType: "blue",
    isActive: currentStage === "PROPOSAL" && !isCancelled && !isOnHold,
  },
  {
    label: "NEGOTIATION",
    to: "?stage=NEGOTIATION&onHold=false&cancelled=false",
    themeType: "blue",
    isActive: currentStage === "NEGOTIATION" && !isCancelled && !isOnHold,
  },
  {
    label: "WON",
    to: "?stage=WON",
    themeType: "approval",
    isActive: currentStage === "WON" && !isCancelled && !isOnHold,
  },
  {
    label: "LOST",
    to: "?stage=LOST",
    themeType: "rejection",
    isActive: currentStage === "LOST" && !isCancelled && !isOnHold,
  },
  {
    label: "ON HOLD",
    to: "?onHold=true",
    themeType: "yellow",
    isActive: isOnHold,
  },
  {
    label: "CANCELLED",
    to: "?cancelled=true",
    themeType: "rejection",
    isActive: isCancelled,
  },
];
