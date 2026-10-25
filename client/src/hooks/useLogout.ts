import { useMutation } from "@tanstack/react-query";
import { logoutMutation } from "../api/generated/@tanstack/react-query.gen";
import type { SuccessResponse } from "../api/generated/types.gen";
import type { QueryErrorState } from "../api/queryState";

export interface UseLogoutResult extends QueryErrorState {
  result: SuccessResponse | undefined;
  logout: () => void;
}

export function useLogout(
  onLoggedOut: (response: SuccessResponse) => void | Promise<void>
): UseLogoutResult {
  const logout = useMutation({
    ...logoutMutation(),
    onSuccess: (data) => onLoggedOut(data),
  });
  const result: UseLogoutResult = {
    result: logout.data,
    isError: logout.isError,
    error: logout.error,
    logout: () => logout.mutate({}),
  };
  return result;
}
