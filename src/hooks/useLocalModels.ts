import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ipc } from "@/ipc/types";
import { queryKeys } from "@/lib/queryKeys";

export function useLocalModels() {
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.languageModels.ollamaLocal,
    queryFn: async () => {
      const { models } = await ipc.languageModel.listOllamaModels();
      return models;
    },
    enabled: false,
  });

  const loadModels = useCallback(async () => {
    const result = await refetch();
    if (result.error) {
      console.debug("Ollama is not available locally:", result.error);
      return [];
    }
    return result.data ?? [];
  }, [refetch]);

  return {
    models: data ?? [],
    loading: isFetching,
    error: error ?? null,
    loadModels,
  };
}
