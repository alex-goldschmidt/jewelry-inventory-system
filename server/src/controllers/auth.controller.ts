import { UserService } from "../services/auth.service";
import executeSafely from "../utils/executeSafely";
import { validateWithZod } from "../utils/errorValidator";
import { UserInput, UserInputSchema } from "../models/userCreateInput.model";
import { AuthTokenResponse } from "../models/auth.model";
import { SuccessResponse } from "../models/common.model";
import { User } from "../models/user.model";
import { HttpStatusCode } from "../constants/constants";
import { RequestHandler } from "express";
import { setRefreshTokenCookie } from "../utils/jwt";
import { UnauthorizedError } from "../config/exceptions";

export interface UserParams {
  userId: string;
}

export const getCurrentUser: RequestHandler<{}, User> = async (req, res, next) => {
  return executeSafely(
    async () => {
      if (!req.user) {
        throw new UnauthorizedError("Missing user identity");
      }
      return UserService.getSingleUserById(Number(req.user.sub));
    },
    res,
    next,
    { onEmpty: { status: HttpStatusCode.NOT_FOUND, message: "User not found" } }
  );
};

/**
 * POST /api/users/register
 *
 * Params: {}
 *
 * Response: SuccessResponse
 */
export const signUp: RequestHandler<{}, SuccessResponse, UserInput> = async (
  req,
  res,
  next
) => {
  const userInput = validateWithZod(UserInputSchema, req.body);

  return executeSafely(() => UserService.createUser(userInput), res, next, {
    successStatus: HttpStatusCode.CREATED,
    onEmpty: {
      status: HttpStatusCode.SERVER_ERROR,
      message: "User not created",
    },
    transform: (success) => ({ success }),
  });
};

/**
 * GET /api/users/:userId
 *
 * Params: { userId : number }
 *
 * Response: User
 */
export const getUserById: RequestHandler<UserParams, User> = async (
  req,
  res,
  next
) => {
  return executeSafely(
    async () =>
      await UserService.getSingleUserById(parseInt(req.params.userId)),
    res,
    next,
    { onEmpty: { status: HttpStatusCode.NOT_FOUND, message: "User not found" } }
  );
};

/**
 * POST /api/users/signIn
 *
 * Params: {}
 *
 * Response: AuthTokenResponse
 */
export const signIn: RequestHandler<{}, AuthTokenResponse, UserInput> = async (
  req,
  res,
  next
) => {
  const userInput = validateWithZod(UserInputSchema, req.body);

  return executeSafely(
    async () => {
      const tokens = await UserService.signIn(userInput);

      await setRefreshTokenCookie(
        res,
        tokens.refreshToken,
        tokens.refreshTokenExpiration
      );
      return { accessToken: tokens.accessToken };
    },
    res,
    next,
    {
      successStatus: HttpStatusCode.SUCCESS,
      onEmpty: {
        status: HttpStatusCode.UNAUTHORIZED,
        message: "Unauthorized",
      },
    }
  );
};
/**
 * POST /api/users/refreshToken
 *
 * Params: {}
 *
 * Response: AuthTokenResponse
 */

export const refreshToken: RequestHandler<{}, AuthTokenResponse> = async (
  req,
  res,
  next
) => {
  return executeSafely(
    async () => {
      const tokenPair = await UserService.refreshAccessToken(req, res);
      await setRefreshTokenCookie(
        res,
        tokenPair.refreshToken,
        tokenPair.refreshTokenExpiration
      );
      return {
        accessToken: tokenPair.accessToken,
      };
    },
    res,
    next,
    {
      successStatus: HttpStatusCode.SUCCESS,
    }
  );
};

/**
 * POST /api/users/logout
 *
 * Params: {}
 *
 * Response: SuccessResponse
 */

export const logout: RequestHandler<{}, SuccessResponse> = async (
  req,
  res,
  next
) => {
  return executeSafely(async () => UserService.logout(req, res), res, next, {
    transform: (success) => ({ success }),
  });
};
