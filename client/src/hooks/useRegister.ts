import { useMutation } from "@tanstack/react-query";
import { registerUserMutation } from "../api/generated/@tanstack/react-query.gen";
import type { SuccessResponse, UserInput } from "../api/generated/types.gen";
import type { QueryErrorState } from "../api/queryState";

export interface UseRegisterResult extends QueryErrorState {
  result: SuccessResponse | undefined;
  register: (input: UserInput) => void;
}

export function useRegister(
  onRegistered: (response: SuccessResponse) => void | Promise<void>
): UseRegisterResult {
  const register = useMutation({
    ...registerUserMutation(),
    onSuccess: (data) => onRegistered(data),
  });
  const result: UseRegisterResult = {
    result: register.data,
    isError: register.isError,
    error: register.error,
    register: (input) => register.mutate({ body: input }),
  };
  return result;
}
