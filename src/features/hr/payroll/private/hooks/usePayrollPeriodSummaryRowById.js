import { useQuery } from "@tanstack/react-query";
import { fetchPayrollPeriodSummary } from "../api/payrollPeriodSummaryService";

// Fallback fetch for a deep link to a row not on the currently displayed
// table (see PayrollExport.jsx's URL-driven sidebar) -- e.g. the URL's
// employeeUuid was filtered out by the current department/employee filter,
// even though the same period is selected. Unlike this page's other
// filters, the underlying RPC is inherently period-bound, so this only
// resolves once startDate/endDate are both set -- same "no sensible
// all-time" constraint usePayrollPeriodSummary itself already has.
// Deliberately omits the department filter so it always finds the row for
// this one employee within the period, regardless of which department is
// currently selected.
export function usePayrollPeriodSummaryRowById(employeeUuid, { startDate, endDate } = {}) {
  const hasPeriod = Boolean(startDate && endDate);

  const { data } = useQuery({
    queryKey: ["payrollPeriodSummaryRow", employeeUuid, startDate, endDate],
    queryFn: async () => {
      const { data } = await fetchPayrollPeriodSummary({
        filters: { startDate, endDate, employee: employeeUuid },
      });
      return data?.[0] || null;
    },
    enabled: hasPeriod && !!employeeUuid,
    staleTime: 1000 * 60 * 5,
  });

  return { data };
}
