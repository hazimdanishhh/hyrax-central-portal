import { useQuery } from "@tanstack/react-query";
import { fetchITAssetById } from "../api/itAssets";

export function useITAssetById(assetId) {
  return useQuery({
    queryKey: ["itAsset", assetId],
    queryFn: () => fetchITAssetById(assetId),
    enabled: !!assetId && assetId !== "new",
    staleTime: 1000 * 60 * 5,
  });
}
