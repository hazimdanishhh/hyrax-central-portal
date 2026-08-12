import { useQuery } from "@tanstack/react-query";
import { fetchSapCustomerByCode } from "../api/sapCustomersService";

export function useSapCustomer(customerCode) {
  return useQuery({
    queryKey: ["sap_customers", customerCode],
    queryFn: () => fetchSapCustomerByCode(customerCode),
    enabled: !!customerCode,
    staleTime: 1000 * 60 * 5,
  });
}
