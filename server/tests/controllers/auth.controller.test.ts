import { createRequest } from "node-mocks-http";
import { createResponse } from "../helpers/http";
import { Request } from "express";
import { HttpStatusCode } from "../../src/constants/constants";
import {
  signUp,
  getUserById,
  getCurrentUser,
  signIn,
  refreshToken,
  logout,
  UserParams,
} from "../../src/controllers/auth.controller";
import { UserService } from "../../src/services/auth.service";
import executeSafely from "../../src/utils/executeSafely";
import { TokenPair } from "../../src/utils/jwt";
import { SuccessResponse } from "../../src/models/common.model";
import { AuthTokenResponse } from "../../src/models/auth.model";
import { User } from "../../src/models/user.model";
import { ValidationError, UnauthorizedError } from "../../src/config/exceptions";

jest.mock("../../src/services/auth.service", () => ({
  UserService: {
    createUser: jest.fn(),
    getSingleUserById: jest.fn(),
    signIn: jest.fn(),
    refreshAccessToken: jest.fn(),
    logout: jest.fn(),
    deleteUser: jest.fn(),
  },
}));
jest.mock("../../src/utils/executeSafely", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedExecuteSafely = jest.mocked(executeSafely);
const mockedUserService = jest.mocked(UserService);

describe("auth.controller", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getCurrentUser", () => {
    it("uses the authenticated identity rather than client-supplied IDs", async () => {
      const req = createRequest({ user: { sub: "7" }, query: { userId: "99" } });
      mockedUserService.getSingleUserById.mockResolvedValueOnce({ userId: 7, email: "me@example.com" });
      await getCurrentUser(req, createResponse(), jest.fn());
      const [fn, , , options] = mockedExecuteSafely.mock.calls[0];
      await expect(fn()).resolves.toEqual({ userId: 7, email: "me@example.com" });
      expect(mockedUserService.getSingleUserById).toHaveBeenCalledWith(7);
      expect(options?.onEmpty).toEqual({ status: 404, message: "User not found" });
    });

    it("rejects a request without an authenticated identity", async () => {
      await getCurrentUser(createRequest(), createResponse(), jest.fn());
      const [fn] = mockedExecuteSafely.mock.calls[0];
      await expect(fn()).rejects.toBeInstanceOf(UnauthorizedError);
      expect(mockedUserService.getSingleUserById).not.toHaveBeenCalled();
    });
  });

  describe("signUp", () => {
    it("passes createUser to executeSafely with expected options", async () => {
      const req = createRequest({
        body: { email: "new@example.com", password: "Password123" },
      });
      const res = createResponse();
      const next = jest.fn();
      mockedUserService.createUser.mockResolvedValueOnce(true);

      await signUp(req, res, next);

      expect(mockedExecuteSafely).toHaveBeenCalledTimes(1);
      const [fn, resArg, nextArg, opts] = mockedExecuteSafely.mock.calls[0];

      expect(resArg).toBe(res);
      expect(nextArg).toBe(next);
      expect(opts).toEqual({
        successStatus: HttpStatusCode.CREATED,
        onEmpty: {
          status: HttpStatusCode.SERVER_ERROR,
          message: "User not created",
        },
        transform: expect.any(Function),
      });

      const result = await fn();
      expect(mockedUserService.createUser).toHaveBeenCalledWith(
        req.body
      );
      expect(result).toBe(true);
      expect(opts?.transform?.(result)).toEqual({
        success: true,
      } satisfies SuccessResponse);
    });
  });

  describe("getUserById", () => {
    it("delegates to UserService.getSingleUserById via executeSafely", async () => {
      const req = createRequest<Request<UserParams>>({ params: { userId: "5" } });
      const res = createResponse();
      const next = jest.fn();
      const user = {
        userId: 5,
        email: "a@b.com",
      } satisfies User;
      mockedUserService.getSingleUserById.mockResolvedValueOnce(user);

      await getUserById(req, res, next);

      expect(mockedExecuteSafely).toHaveBeenCalledTimes(1);
      const [fn, resArg, nextArg, options] = mockedExecuteSafely.mock.calls[0];
      expect(options?.onEmpty).toEqual({ status: 404, message: "User not found" });
      expect(resArg).toBe(res);
      expect(nextArg).toBe(next);

      const result = await fn();
      expect(mockedUserService.getSingleUserById).toHaveBeenCalledWith(5);
      expect(result).toEqual(user);
    });
  });

  describe("signIn", () => {
    it("validates request body before calling executeSafely", async () => {
      const req = createRequest({
        body: { email: "not-an-email", password: "short" },
      });
      const res = createResponse();
      const next = jest.fn();

      await expect(signIn(req, res, next)).rejects.toBeInstanceOf(
        ValidationError
      );

      expect(mockedExecuteSafely).not.toHaveBeenCalled();
    });

    it("sets refresh cookie and returns access token", async () => {
      const req = createRequest({
        body: { email: "john@example.com", password: "Password123" },
      });
      const res = createResponse();
      const next = jest.fn();
      const tokenPair: TokenPair = {
        accessToken: "access",
        refreshToken: "refresh",
        refreshTokenExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockedUserService.signIn.mockResolvedValueOnce(tokenPair);

      await signIn(req, res, next);

      expect(mockedExecuteSafely).toHaveBeenCalledTimes(1);
      const [fn, resArg, nextArg, opts] = mockedExecuteSafely.mock.calls[0];
      expect(resArg).toBe(res);
      expect(nextArg).toBe(next);
      expect(opts).toEqual({
        successStatus: HttpStatusCode.SUCCESS,
        onEmpty: {
          status: HttpStatusCode.UNAUTHORIZED,
          message: "Unauthorized",
        },
      });

      const result = await fn();

      expect(mockedUserService.signIn).toHaveBeenCalledWith(
        req.body
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        tokenPair.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          maxAge: expect.any(Number),
        })
      );
      expect(res.cookies.refreshToken.options?.maxAge).toBeGreaterThan(0);
      expect(result).toEqual({
        accessToken: tokenPair.accessToken,
      } satisfies AuthTokenResponse);
    });
  });

  describe("refreshToken", () => {
    it("returns access token from service", async () => {
      const req = createRequest({
        cookies: { refreshToken: "old" },
      });
      const res = createResponse();
      const next = jest.fn();
      const tokenPair: TokenPair = {
        accessToken: "newAccess",
        refreshToken: "newRefresh",
        refreshTokenExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockedUserService.refreshAccessToken.mockResolvedValueOnce(tokenPair);

      await refreshToken(req, res, next);

      expect(mockedExecuteSafely).toHaveBeenCalledTimes(1);
      const [fn, resArg, nextArg, opts] = mockedExecuteSafely.mock.calls[0];
      expect(resArg).toBe(res);
      expect(nextArg).toBe(next);
      expect(opts).toEqual({ successStatus: HttpStatusCode.SUCCESS });

      const result = await fn();
      expect(mockedUserService.refreshAccessToken).toHaveBeenCalledWith(
        req,
        res
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        tokenPair.refreshToken,
        expect.objectContaining({
          maxAge: expect.any(Number),
        })
      );
      expect(result).toEqual({
        accessToken: tokenPair.accessToken,
      } satisfies AuthTokenResponse);
    });
  });

  describe("logout", () => {
    it("passes logout call through executeSafely", async () => {
      const req = createRequest({
        cookies: { refreshToken: "oldToken" },
      });
      const res = createResponse();
      const next = jest.fn();

      mockedUserService.logout.mockResolvedValueOnce(true);

      await logout(req, res, next);

      expect(mockedExecuteSafely).toHaveBeenCalledTimes(1);
      const [fn, resArg, nextArg, opts] = mockedExecuteSafely.mock.calls[0];
      expect(resArg).toBe(res);
      expect(nextArg).toBe(next);

      const result = await fn();
      expect(mockedUserService.logout).toHaveBeenCalledWith(req, res);
      expect(result).toBe(true);
      expect(opts?.transform?.(result)).toEqual({
        success: true,
      } satisfies SuccessResponse);
    });
  });
});
