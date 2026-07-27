export function getSalesBudgetsFilterConfig({ salesReps = [] } = {}) {
  return [
    {
      key: "salesRepCode",
      label: "Sales Rep",
      options: salesReps.map((rep) => ({
        label: rep.sales_rep_name,
        value: rep.sales_rep_code,
      })),
    },
  ];
}
