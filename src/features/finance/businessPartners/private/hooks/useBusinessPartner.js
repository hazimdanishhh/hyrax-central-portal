import { useQuery } from "@tanstack/react-query";
import { fetchBusinessPartnerByCode } from "../api/businessPartnersService";

export function useBusinessPartner(code) {
  return useQuery({
    queryKey: ["business_partners", code],
    queryFn: () => fetchBusinessPartnerByCode(code),
    enabled: !!code,
    staleTime: 1000 * 60 * 5,
  });
}
