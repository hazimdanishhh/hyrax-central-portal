import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrders } from "../api/salesOrdersService";

// Client -> SAP Business Partner bridge is clients.sap_bp_id ->
// sap_sales_orders.customer_code (same bridge Orders.jsx's own Customer
// filter uses). Fixed 2026-08 -- ClientSidebar's "Orders" tab previously
// rendered LeadsManagement instead of any sales-order data at all.
export function useClientSalesOrders(sapBpId) {
  return useQuery({
    queryKey: ["client_sales_orders", sapBpId],
    queryFn: () =>
      fetchSalesOrders({
        page: 1,
        pageSize: 10,
        filters: { customerCode: sapBpId },
        sortBy: "order_date",
        sortOrder: "descending",
      }),
    enabled: !!sapBpId,
    staleTime: 1000 * 60 * 5,
  });
}
