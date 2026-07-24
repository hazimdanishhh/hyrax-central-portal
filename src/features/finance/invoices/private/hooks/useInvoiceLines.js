import { useQuery } from "@tanstack/react-query";
import { fetchInvoiceLines } from "../api/fetchInvoiceLines";

export function useInvoiceLines(invoiceDocEntry) {
  return useQuery({
    queryKey: ["invoice_lines", invoiceDocEntry],
    queryFn: () => fetchInvoiceLines(invoiceDocEntry),
    enabled: !!invoiceDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
