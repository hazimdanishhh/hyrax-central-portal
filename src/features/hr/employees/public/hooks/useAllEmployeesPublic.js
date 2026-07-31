import { useQuery } from "@tanstack/react-query";
import { fetchAllEmployeesPublic } from "../api/allEmployeesPublic";

/**
 * Hook to fetch every active employees_public row, unpaginated -- for
 * building a client-side org tree (see buildOrganizationTree.js).
 */
export default function useAllEmployeesPublic() {
  return useQuery({
    queryKey: ["employees_public_all"],
    queryFn: fetchAllEmployeesPublic,
    staleTime: 1000 * 60 * 5,
  });
}
