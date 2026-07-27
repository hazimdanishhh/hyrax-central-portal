import { useQuery } from "@tanstack/react-query";
import { fetchVendorPaymentApplications } from "../api/fetchVendorPaymentApplications";

export function useVendorPaymentApplications(vendorPaymentDocEntry) {
  return useQuery({
    queryKey: ["vendor_payment_applications", vendorPaymentDocEntry],
    queryFn: () => fetchVendorPaymentApplications(vendorPaymentDocEntry),
    enabled: !!vendorPaymentDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
