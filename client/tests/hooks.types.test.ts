import { expectTypeOf, it } from "vitest";
import type {
  AuthTokenResponse, GetCurrentUserResponse, LogoutResponse,
  RefreshAccessTokenResponse, RegisterUserResponse, SignInResponse, SuccessResponse, User, UserInput,
} from "../src/api/generated/types.gen";
import type { QueryErrorState } from "../src/api/queryState";
import type { UseCurrentUserResult } from "../src/hooks/useCurrentUser";
import type { UseSignInResult } from "../src/hooks/useSignIn";
import type { UseRegisterResult } from "../src/hooks/useRegister";
import type { UseRefreshResult } from "../src/hooks/useRefresh";
import type { UseLogoutResult } from "../src/hooks/useLogout";

it("keeps hook data aligned with the generated endpoint response models", () => {
  expectTypeOf<GetCurrentUserResponse>().toEqualTypeOf<User>();
  expectTypeOf<SignInResponse>().toEqualTypeOf<AuthTokenResponse>();
  expectTypeOf<RefreshAccessTokenResponse>().toEqualTypeOf<AuthTokenResponse>();
  expectTypeOf<RegisterUserResponse>().toEqualTypeOf<SuccessResponse>();
  expectTypeOf<LogoutResponse>().toEqualTypeOf<SuccessResponse>();

  expectTypeOf<UseCurrentUserResult["user"]>().toEqualTypeOf<GetCurrentUserResponse | undefined>();
  expectTypeOf<UseSignInResult["tokens"]>().toEqualTypeOf<SignInResponse | undefined>();
  expectTypeOf<UseRefreshResult["tokens"]>().toEqualTypeOf<RefreshAccessTokenResponse | undefined>();
  expectTypeOf<UseRegisterResult["result"]>().toEqualTypeOf<RegisterUserResponse | undefined>();
  expectTypeOf<UseLogoutResult["result"]>().toEqualTypeOf<LogoutResponse | undefined>();
});

it("exposes domain actions and shared errors without leaking TanStack state", () => {
  expectTypeOf<UseSignInResult["signIn"]>().parameter(0).toEqualTypeOf<UserInput>();
  expectTypeOf<UseRegisterResult["register"]>().parameter(0).toEqualTypeOf<UserInput>();
  expectTypeOf<keyof UseCurrentUserResult>().toEqualTypeOf<"user" | "isError" | "error">();
  expectTypeOf<keyof UseSignInResult>().toEqualTypeOf<"tokens" | "signIn" | "isError" | "error">();
  expectTypeOf<keyof UseRefreshResult>().toEqualTypeOf<"tokens" | "refresh" | "isError" | "error">();
  expectTypeOf<keyof UseRegisterResult>().toEqualTypeOf<"result" | "register" | "isError" | "error">();
  expectTypeOf<keyof UseLogoutResult>().toEqualTypeOf<"result" | "logout" | "isError" | "error">();
  expectTypeOf<UseCurrentUserResult | UseSignInResult | UseRefreshResult | UseRegisterResult | UseLogoutResult>()
    .toExtend<QueryErrorState>();
});
