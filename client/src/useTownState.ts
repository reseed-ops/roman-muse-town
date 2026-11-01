import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";

export type TownState = ApiResponse<typeof api, "getState">;
export function useTownState() {
  const queryClient = useQueryClient();
  const state = useQuery({ queryKey: ["town-state"], queryFn: () => api.getState({}) });
  const applyState = useCallback((data: Partial<TownState>) => {
    queryClient.setQueryData<TownState>(["town-state"], (previous) => {
      if (previous) return { ...previous, ...data };
      return "journal" in data ? data as TownState : undefined;
    });
    if (!queryClient.getQueryData(["town-state"])) void queryClient.invalidateQueries({ queryKey: ["town-state"] });
  }, [queryClient]);
  return { state, applyState };
}
