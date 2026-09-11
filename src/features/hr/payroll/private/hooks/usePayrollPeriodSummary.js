import { useQuery } from "@tanstack/react-query";
import { fetchPayrollPeriodSummary } from "../api/payrollPeriodSummaryService";

/**
 * Only fetches once a full cycle (startDate + endDate) is selected -- there
 * is no sensible "all time" payroll summary, unlike Attendance
 * Overview/List which default to month-to-date.
 */
export default function usePayrollPeriodSummary(filters) {
  const hasPeriod = Boolean(filters?.startDate && filters?.endDate);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["payrollPeriodSummary", filters],
    queryFn: () =>
      fetchPayrollPeriodSummary({ filters }).then((res) => res.data),
    enabled: hasPeriod,
  });

  return {
    rows: data || [],
    isLoading,
    isFetching,
    error,
    hasPeriod,
  };
}
