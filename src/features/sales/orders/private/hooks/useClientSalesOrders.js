import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrders } from "../api/salesOrdersService";

// Client -> SAP customer bridge is clients.sap_customer_code ->
// sap_sales_orders.customer_code (same bridge Orders.jsx's own Customer
// filter uses). Renamed from sap_bp_id 2026-08 when the bridge was given a
// real FK + validated search picker (see hyrax-central-portal/docs/
// DASHBOARD-ROADMAP.md §1.4) -- previously a free-typed, unvalidated field.
export function useClientSalesOrders(sapCustomerCode) {
  return useQuery({
    queryKey: ["client_sales_orders", sapCustomerCode],
    queryFn: () =>
      fetchSalesOrders({
        page: 1,
        pageSize: 10,
        filters: { customerCode: sapCustomerCode },
        sortBy: "order_date",
        sortOrder: "descending",
      }),
    enabled: !!sapCustomerCode,
    staleTime: 1000 * 60 * 5,
  });
}
