import { useQuery } from "@tanstack/react-query";
import { getCurrentUserOptions } from "../api/generated/@tanstack/react-query.gen";
import type { User } from "../api/generated/types.gen";
import type { QueryErrorState } from "../api/queryState";

export interface UseCurrentUserResult extends QueryErrorState {
  user: User | undefined;
}

export function useCurrentUser(enabled: boolean): UseCurrentUserResult {
  const currentUser = useQuery({ ...getCurrentUserOptions(), enabled });
  const result: UseCurrentUserResult = {
    user: currentUser.data,
    isError: currentUser.isError,
    error: currentUser.error,
  };
  return result;
}
