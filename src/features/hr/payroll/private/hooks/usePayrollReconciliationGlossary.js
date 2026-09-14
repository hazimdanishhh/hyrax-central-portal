import { useQuery } from "@tanstack/react-query";
import { fetchPayrollReconciliationGlossary } from "../api/payrollReconciliationGlossaryService";

/**
 * Long staleTime, same reasoning as useAttendanceActivitiesMetadata.js --
 * this lookup data changes essentially never (an admin-edited wording
 * change, not a daily one).
 */
export default function usePayrollReconciliationGlossary() {
  const { data, isLoading } = useQuery({
    queryKey: ["payrollReconciliationGlossary"],
    queryFn: fetchPayrollReconciliationGlossary,
    staleTime: 1000 * 60 * 10,
  });

  const byCode = (data || []).reduce((acc, entry) => {
    acc[entry.code] = entry;
    return acc;
  }, {});

  return { glossary: data || [], glossaryByCode: byCode, isLoading };
}
