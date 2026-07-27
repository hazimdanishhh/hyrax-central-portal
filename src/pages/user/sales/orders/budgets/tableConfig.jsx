// pages/user/sales/orders/budgets/tableConfig.jsx

function formatMonth(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export const salesBudgetsTableConfig = ({ salesReps = [] } = {}) => [
  {
    key: "id",
    label: "ID",
    getValue: (row) => row.id,
    show: false,
  },
  {
    key: "sales_rep_code",
    label: "Sales Rep",
    getValue: (row) => row.sales_rep_code,
    displayValue: (row) => row.sales_rep?.sales_rep_name || "—",
    editable: true,
    editor: "select",
    options: salesReps.map((rep) => ({
      label: rep.sales_rep_name,
      value: rep.sales_rep_code,
    })),
    required: true,
    isClearable: false,
  },
  {
    key: "budget_month",
    label: "Budget Month",
    getValue: (row) => row.budget_month,
    displayValue: (row) => formatMonth(row.budget_month),
    editable: true,
    editor: "date",
    required: true,
  },
  {
    key: "budget_revenue",
    label: "Budget Revenue (RM)",
    getValue: (row) => row.budget_revenue,
    displayValue: (row) =>
      `RM ${Math.round(row.budget_revenue || 0).toLocaleString()}`,
    editable: true,
    editor: "number",
    min: 0,
    required: true,
  },
];
