import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLinkedEmployee,
  fetchUnlinkedEmployees,
  linkProfileToEmployee,
} from "../api/employeeLink";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

const errorConfig = { entity: "employee link" };

export function useLinkedEmployee(profileId) {
  return useQuery({
    queryKey: ["linkedEmployee", profileId],
    queryFn: () => fetchLinkedEmployee(profileId),
    enabled: !!profileId,
  });
}

export function useUnlinkedEmployees() {
  const query = useQuery({
    queryKey: ["unlinkedEmployees"],
    queryFn: fetchUnlinkedEmployees,
    staleTime: 1000 * 60,
  });

  return { ...query, employees: query.data || [] };
}

export function useLinkProfileToEmployee() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const mutation = useMutation({
    mutationFn: linkProfileToEmployee,

    onMutate: () => {
      showMessage("Updating employee link...", "loading");
    },

    onSuccess: (_, { profileId }) => {
      showMessage("Employee link updated", "success");

      queryClient.invalidateQueries({ queryKey: ["linkedEmployee", profileId] });
      queryClient.invalidateQueries({ queryKey: ["unlinkedEmployees"] });
      queryClient.invalidateQueries({ queryKey: ["usersOverview"] });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, errorConfig), "error");
    },
  });

  return {
    linkProfileToEmployee: mutation.mutateAsync,
    linking: mutation.isPending,
  };
}
