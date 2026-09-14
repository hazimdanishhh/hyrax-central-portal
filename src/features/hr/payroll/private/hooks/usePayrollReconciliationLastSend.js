import { useQuery } from "@tanstack/react-query";
import { fetchLastPayrollReconciliationEmailSend } from "../api/payrollReconciliationEmailSendsService";

export default function usePayrollReconciliationLastSend({
  employeeUuid,
  startDate,
  endDate,
}) {
  const enabled = Boolean(employeeUuid && startDate && endDate);

  const { data, isLoading } = useQuery({
    queryKey: ["payrollReconciliationLastSend", employeeUuid, startDate, endDate],
    queryFn: () =>
      fetchLastPayrollReconciliationEmailSend({
        employeeUuid,
        startDate,
        endDate,
      }),
    enabled,
  });

  return { lastSend: data || null, isLoading };
}
