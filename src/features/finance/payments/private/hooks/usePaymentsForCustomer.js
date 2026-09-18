import { useQuery } from "@tanstack/react-query";
import { fetchPayments } from "../api/paymentsService";

// Backs the Business Partner Sidebar's "Payments" preview -- a plain
// customerCode-filtered page, reusing fetchPayments' existing customerCode
// filter at a small page size. See useInvoicesForCustomer.js's own comment
// for why this isn't a document-trail lookup.
export function usePaymentsForCustomer(customerCode, enabled = true) {
  return useQuery({
    queryKey: ["payments_for_customer", customerCode],
    queryFn: () =>
      fetchPayments({
        page: 1,
        pageSize: 5,
        search: "",
        filters: { customerCode },
        sortBy: "payment_date",
        sortOrder: "descending",
      }),
    enabled: !!customerCode && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
