import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "../api/invoicesService";

// Backs the Business Partner Sidebar's "Open Invoices" preview -- a plain
// customerCode-filtered page (not the SO<->invoice document-trail lookup
// useInvoicesForSalesOrder.js does), reusing fetchInvoices' existing
// customerCode filter at a small page size.
export function useInvoicesForCustomer(customerCode, enabled = true) {
  return useQuery({
    queryKey: ["invoices_for_customer", customerCode],
    queryFn: () =>
      fetchInvoices({
        page: 1,
        pageSize: 5,
        search: "",
        filters: { customerCode },
        sortBy: "invoice_date",
        sortOrder: "descending",
      }),
    enabled: !!customerCode && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
