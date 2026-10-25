export interface QueryErrorState {
  isError: boolean;
  error: unknown;
}

export function resolveQueryErrorState(...states: QueryErrorState[]) {
  const failedState = states.find((state) => state.isError);
  const errorState: QueryErrorState = {
    isError: failedState !== undefined,
    error: failedState?.error,
  };
  return errorState;
}
