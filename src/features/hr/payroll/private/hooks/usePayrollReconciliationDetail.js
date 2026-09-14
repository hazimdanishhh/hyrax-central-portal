import { useQuery } from "@tanstack/react-query";
import { fetchPayrollReconciliationDetail } from "../api/payrollReconciliationDetailService";

export default function usePayrollReconciliationDetail({
  employeeUuid,
  startDate,
  endDate,
}) {
  const enabled = Boolean(employeeUuid && startDate && endDate);

  const { data, isLoading, error } = useQuery({
    queryKey: ["payrollReconciliationDetail", employeeUuid, startDate, endDate],
    queryFn: () =>
      fetchPayrollReconciliationDetail({ employeeUuid, startDate, endDate }),
    enabled,
  });

  return { rows: data || [], isLoading, error };
}
