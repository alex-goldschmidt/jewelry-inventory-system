import { useMutation } from "@tanstack/react-query";
import { signInMutation } from "../api/generated/@tanstack/react-query.gen";
import type { AuthTokenResponse, UserInput } from "../api/generated/types.gen";
import type { QueryErrorState } from "../api/queryState";

export interface UseSignInResult extends QueryErrorState {
  tokens: AuthTokenResponse | undefined;
  signIn: (input: UserInput) => void;
}

export function useSignIn(
  onSignedIn: (response: AuthTokenResponse) => void | Promise<void>
): UseSignInResult {
  const signIn = useMutation({
    ...signInMutation(),
    onSuccess: (data) => onSignedIn(data),
  });
  const result: UseSignInResult = {
    tokens: signIn.data,
    isError: signIn.isError,
    error: signIn.error,
    signIn: (input) => signIn.mutate({ body: input }),
  };
  return result;
}
