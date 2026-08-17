import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchProjectCategories,
  getOrCreateProjectCategory,
} from "../api/projectCategoriesService";
import { useMessage } from "../../../../../context/MessageContext";
import { getFriendlyError } from "@/features/_shared/getFriendlyError";

export function useProjectCategories() {
  const query = useQuery({
    queryKey: ["projectCategories"],
    queryFn: fetchProjectCategories,
    staleTime: 1000 * 60 * 10, // changes rarely
  });

  return {
    ...query,
    categories: query.data || [],
  };
}

export function useCreateProjectCategory() {
  const queryClient = useQueryClient();
  const { showMessage } = useMessage();

  const createMutation = useMutation({
    mutationFn: getOrCreateProjectCategory,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectCategories"] });
    },

    onError: (err) => {
      showMessage(getFriendlyError(err, { entity: "category" }), "error");
    },
  });

  return {
    createCategory: createMutation.mutateAsync,
    creating: createMutation.isPending,
  };
}
