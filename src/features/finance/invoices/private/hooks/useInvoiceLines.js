import { useQuery } from "@tanstack/react-query";
import { fetchInvoiceLines } from "../api/fetchInvoiceLines";

// `enabled` (default true -- existing callers unaffected) lets a
// collapsible section defer this fetch until the user actually expands it
// (InvoiceSidebar.jsx), same pattern as useSalesOrderLines.js.
export function useInvoiceLines(invoiceDocEntry, enabled = true) {
  return useQuery({
    queryKey: ["invoice_lines", invoiceDocEntry],
    queryFn: () => fetchInvoiceLines(invoiceDocEntry),
    enabled: !!invoiceDocEntry && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
