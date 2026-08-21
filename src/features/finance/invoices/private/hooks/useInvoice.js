import { useQuery } from "@tanstack/react-query";
import { fetchInvoiceByDocEntry } from "../api/invoicesService";

// Fetch-by-id fallback for the /app/finance/invoices/:docEntry detail route
// -- covers a direct/shared URL where the invoice isn't already in the
// in-memory paginated list. Mirrors useSalesOrder.js's role for Orders.jsx
// exactly.
export function useInvoice(docEntry) {
  return useQuery({
    queryKey: ["invoice", docEntry],
    queryFn: () => fetchInvoiceByDocEntry(docEntry),
    enabled: !!docEntry,
    staleTime: 1000 * 60 * 5,
  });
}
