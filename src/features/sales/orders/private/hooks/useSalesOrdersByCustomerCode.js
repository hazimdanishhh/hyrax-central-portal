import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrders } from "../api/salesOrdersService";

// A lead's SAP-customer bridge is sales_leads.sap_customer_code ->
// sap_sales_orders.customer_code (same bridge Orders.jsx's own Customer
// filter uses). Moved here from the Clients feature (2026-08, renamed from
// useClientSalesOrders) when the SAP link moved off clients and onto
// sales_leads directly -- see hyrax-central-portal/docs/DASHBOARD-ROADMAP.md
// §1.4.
export function useSalesOrdersByCustomerCode(sapCustomerCode) {
  return useQuery({
    queryKey: ["sales_orders_by_customer_code", sapCustomerCode],
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
