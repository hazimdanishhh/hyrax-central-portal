import { useQuery } from "@tanstack/react-query";
import { fetchLeadByPoNumber } from "../api/fetchLeadById";

// Reverse of useSalesOrderByPoNumber.js -- sap_sales_orders.customer_ref
// (SAP NumAtCard) matched against sales_leads.po_number. Backs the Sales
// Order Sidebar's "View Matching Lead" button.
export function useLeadByPoNumber(poNumber) {
  return useQuery({
    queryKey: ["lead_by_po_number", poNumber],
    queryFn: () => fetchLeadByPoNumber(poNumber),
    enabled: !!poNumber,
    staleTime: 1000 * 60 * 5,
  });
}
