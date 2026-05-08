// hooks/itAssets/useITAssetsMetadata.js
import { useQuery } from "@tanstack/react-query";
import { fetchITAssetsMetadata } from "../api/itAssetsMetadata";

export function useITAssetsMetadata() {
  const query = useQuery({
    queryKey: ["itAssetsMetadata"],
    queryFn: fetchITAssetsMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    categories: query.data?.categories || [],
    subcategories: query.data?.subcategories || [],
    conditions: query.data?.conditions || [],
    manufacturers: query.data?.manufacturers || [],
    operatingSystems: query.data?.operatingSystems || [],
    statuses: query.data?.statuses || [],
    departments: query.data?.departments || [],
    employees: query.data?.employees || [],
  };
}
