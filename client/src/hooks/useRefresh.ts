import { useMutation } from "@tanstack/react-query";
import { refreshAccessTokenMutation } from "../api/generated/@tanstack/react-query.gen";
import type { AuthTokenResponse } from "../api/generated/types.gen";
import type { QueryErrorState } from "../api/queryState";

export interface UseRefreshResult extends QueryErrorState {
  tokens: AuthTokenResponse | undefined;
  refresh: () => void;
}

export function useRefresh(
  onSessionChanged: (response: AuthTokenResponse | undefined) => void | Promise<void>
): UseRefreshResult {
  const refresh = useMutation({
    ...refreshAccessTokenMutation(),
    onSuccess: (data) => onSessionChanged(data),
    onError: () => onSessionChanged(undefined),
  });
  const result: UseRefreshResult = {
    tokens: refresh.data,
    isError: refresh.isError,
    error: refresh.error,
    refresh: () => refresh.mutate({}),
  };
  return result;
}
