import { useQuery } from "@tanstack/react-query";
import { fetchPaymentApplications } from "../api/fetchPaymentApplications";

export function usePaymentApplications(paymentDocEntry) {
  return useQuery({
    queryKey: ["payment_applications", paymentDocEntry],
    queryFn: () => fetchPaymentApplications(paymentDocEntry),
    enabled: !!paymentDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
