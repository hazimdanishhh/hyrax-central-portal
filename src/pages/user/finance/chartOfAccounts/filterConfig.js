import { DRAWER_OPTIONS } from "./drawerLabels";

export function getChartOfAccountsFilterConfig() {
  return [
    {
      key: "drawer",
      label: "Drawer",
      options: DRAWER_OPTIONS,
    },
    {
      key: "isPostable",
      label: "Postable",
      options: [
        { label: "Postable (leaf accounts)", value: "Y" },
        { label: "Summary/Title accounts", value: "N" },
      ],
    },
  ];
}
