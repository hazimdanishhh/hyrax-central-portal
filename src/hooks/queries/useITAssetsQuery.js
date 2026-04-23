// useITAssetsQuery.js
import { useQuery } from "@tanstack/react-query";
import { fetchITAssets } from "../../services/itAssetsServices/itAssetsService";

export default function useITAssetsQuery(params) {
  const { page, search, filters, sortBy, sortOrder } = params;

  return useQuery({
    queryKey: ["itAssets", { page, search, filters, sortBy, sortOrder }],
    queryFn: () =>
      fetchITAssets({
        ...params,
        pageSize: 20,
      }),
    keepPreviousData: true,
  });
}
