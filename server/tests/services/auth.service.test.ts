import { dbRow } from "../helpers/dbRow";
import { createRequest } from "node-mocks-http";
import { createResponse } from "../helpers/http";
import { verify } from "@node-rs/argon2";
import { UserService } from "../../src/services/auth.service";
import { UserRepository } from "../../src/repositories/auth.repository";
import { RefreshTokenRepository } from "../../src/repositories/refreshToken.repository";
import { AuthUserDTO } from "../../src/dtos/projections/user.projection";
import { UserDTO } from "../../src/dtos/user.dto";
import { UserInput } from "../../src/models/userCreateInput.model";
import { validateWithZod } from "../../src/utils/errorValidator";
import {
  clearRefreshTokenCookie,
  createTokenHash,
  generateTokenPair,
  handleRefreshToken,
  TokenPair,
  verifyRefreshToken,
} from "../../src/utils/jwt";
import { hashPassword } from "../../src/utils/password";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "../../src/config/exceptions";

jest.mock("../../src/repositories/auth.repository.ts");
jest.mock("../../src/repositories/refreshToken.repository.ts");
jest.mock("../../src/utils/errorValidator");
jest.mock("../../src/utils/password");
jest.mock("@node-rs/argon2", () => ({ verify: jest.fn() }));
jest.mock("../../src/utils/jwt", () => ({
  generateTokenPair: jest.fn(),
  handleRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  createTokenHash: jest.fn(),
  clearRefreshTokenCookie: jest.fn(),
}));

const mockedUserRepo = jest.mocked(UserRepository);
const mockedRefreshRepo = jest.mocked(RefreshTokenRepository);
const mockedValidateWithZod = jest.mocked(validateWithZod);
const mockedVerify = jest.mocked(verify);
const mockedGenerateTokenPair = jest.mocked(generateTokenPair);
const mockedHandleRefreshToken = jest.mocked(handleRefreshToken);
const mockedVerifyRefreshToken = jest.mocked(verifyRefreshToken);
const mockedCreateTokenHash = jest.mocked(createTokenHash);
const mockedClearRefreshTokenCookie = jest.mocked(clearRefreshTokenCookie);
const mockedHashPassword = jest.mocked(hashPassword);

describe("UserService", () => {
  beforeEach(() => {
    mockedValidateWithZod.mockImplementation((schema, data) => schema.parse(data));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("gets user by user id", async () => {
    const fake: UserDTO = dbRow({
      userId: 1,
      email: "test@email.com",
      password: "hash",
      inserted: "2026-01-17 09:02:58",
      updated: "2026-01-17 09:02:58",
    });
    mockedUserRepo.queryByUserId.mockResolvedValueOnce(fake);

    const user = await UserService.getSingleUserById(1);
    expect(user).toEqual({
      userId: 1,
      email: "test@email.com",
    });
    expect(mockedUserRepo.queryByUserId).toHaveBeenCalledWith(1);
  });

  describe("signIn", () => {
    const userInput: UserInput = {
      email: "john@example.com",
      password: "Password123",
    };

    it("returns a token pair for valid credentials", async () => {
      const userInDb: AuthUserDTO = dbRow({ userId: 7, email: userInput.email, password: "hash" });
      const tokens: TokenPair = {
        accessToken: "access123",
        refreshToken: "refresh123",
        refreshTokenExpiration: new Date("2026-01-22T22:11:35.000Z"),
      };

      mockedUserRepo.queryByEmail.mockResolvedValueOnce(userInDb);
      mockedVerify.mockResolvedValueOnce(true);
      mockedGenerateTokenPair.mockResolvedValueOnce(tokens);

      const result = await UserService.signIn(userInput);

      expect(result).toEqual(tokens);
      expect(mockedValidateWithZod).toHaveBeenCalledWith(
        expect.anything(),
        userInput
      );
      expect(mockedUserRepo.queryByEmail).toHaveBeenCalledWith(userInput.email);
      expect(mockedVerify).toHaveBeenCalledWith("hash", userInput.password);
      expect(mockedHandleRefreshToken).toHaveBeenCalledWith(
        tokens.refreshToken,
        userInDb.userId,
        tokens.refreshTokenExpiration
      );
    });

    it("throws generic UnauthorizedError and verifies a dummy hash when email is not found", async () => {
      mockedUserRepo.queryByEmail.mockResolvedValueOnce(null);
      mockedVerify.mockResolvedValueOnce(false);

      await expect(UserService.signIn(userInput)).rejects.toMatchObject({
        constructor: UnauthorizedError,
        message: "Invalid email or password.",
      });
      expect(mockedVerify).toHaveBeenCalledWith(
        expect.stringMatching(/^\$argon2id\$/),
        userInput.password
      );
      expect(mockedGenerateTokenPair).not.toHaveBeenCalled();
    });

    it("throws generic UnauthorizedError when password is incorrect", async () => {
      mockedUserRepo.queryByEmail.mockResolvedValueOnce(dbRow({
        userId: 2,
        email: userInput.email,
        password: "hash",
      }));
      mockedVerify.mockResolvedValueOnce(false);

      await expect(UserService.signIn(userInput)).rejects.toMatchObject({
        constructor: UnauthorizedError,
        message: "Invalid email or password.",
      });
      expect(mockedGenerateTokenPair).not.toHaveBeenCalled();
    });
  });

  describe("refreshAccessToken", () => {
    it.each([42, {}, ["token"], null, ""])(
      "rejects malformed refresh cookies before verification: %p", async (refreshToken) => {
        const req = createRequest();
        req.cookies.refreshToken = refreshToken;
        await expect(UserService.refreshAccessToken(req, createResponse()))
          .rejects.toBeInstanceOf(UnauthorizedError);
        expect(mockedVerifyRefreshToken).not.toHaveBeenCalled();
        expect(mockedCreateTokenHash).not.toHaveBeenCalled();
      }
    );
    it("returns a new token pair and revokes the old refresh token", async () => {
      const req = createRequest({
        cookies: { refreshToken: "oldToken" },
      });
      const res = createResponse();
      const tokens: TokenPair = {
        accessToken: "newAccess",
        refreshToken: "newRefresh",
        refreshTokenExpiration: new Date("2026-01-22T22:11:35.000Z"),
      };

      mockedVerifyRefreshToken.mockResolvedValueOnce({ sub: "10" });
      mockedCreateTokenHash.mockResolvedValueOnce("oldHash");
      mockedRefreshRepo.queryByUserIdAndTokenHash.mockResolvedValueOnce(dbRow({
        isRevoked: 0,
        expiration: new Date(Date.now() + 60_000),
      }));
      mockedRefreshRepo.revokeActiveTokenByHash.mockResolvedValueOnce(1);
      mockedGenerateTokenPair.mockResolvedValueOnce(tokens);

      const result = await UserService.refreshAccessToken(req, res);

      expect(result).toEqual(tokens);
      expect(mockedVerifyRefreshToken).toHaveBeenCalledWith("oldToken");
      expect(mockedCreateTokenHash).toHaveBeenCalledWith("oldToken");
      expect(mockedRefreshRepo.revokeActiveTokenByHash).toHaveBeenCalledWith(
        "oldHash",
        10
      );
      expect(mockedHandleRefreshToken).toHaveBeenCalledWith(
        tokens.refreshToken,
        10,
        tokens.refreshTokenExpiration
      );
    });

    it("throws UnauthorizedError when refresh token cookie is missing", async () => {
      const req = createRequest({ cookies: {} });
      const res = createResponse();

      await expect(UserService.refreshAccessToken(req, res)).rejects.toBeInstanceOf(
        UnauthorizedError
      );
      expect(mockedVerifyRefreshToken).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedError when token is not stored", async () => {
      const req = createRequest({
        cookies: { refreshToken: "oldToken" },
      });
      const res = createResponse();

      mockedVerifyRefreshToken.mockResolvedValueOnce({ sub: "5" });
      mockedCreateTokenHash.mockResolvedValueOnce("hash");
      mockedRefreshRepo.queryByUserIdAndTokenHash.mockResolvedValueOnce(null);

      await expect(UserService.refreshAccessToken(req, res)).rejects.toBeInstanceOf(
        UnauthorizedError
      );
    });

    it("revokes all active tokens and clears cookie when token reuse is detected", async () => {
      const req = createRequest({
        cookies: { refreshToken: "oldToken" },
      });
      const res = createResponse();

      mockedVerifyRefreshToken.mockResolvedValueOnce({ sub: "3" });
      mockedCreateTokenHash.mockResolvedValueOnce("hash");
      mockedRefreshRepo.queryByUserIdAndTokenHash.mockResolvedValueOnce(dbRow({
        isRevoked: 0,
        expiration: new Date(Date.now() + 60_000),
      }));
      mockedRefreshRepo.revokeActiveTokenByHash.mockResolvedValueOnce(0);

      await expect(UserService.refreshAccessToken(req, res)).rejects.toBeInstanceOf(
        ForbiddenError
      );
      expect(mockedRefreshRepo.revokeAllActiveTokensForUser).toHaveBeenCalledWith(
        3
      );
      expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
      expect(mockedGenerateTokenPair).not.toHaveBeenCalled();
    });

    it("clears cookie and throws ForbiddenError when stored token is expired", async () => {
      const req = createRequest({
        cookies: { refreshToken: "oldToken" },
      });
      const res = createResponse();

      mockedVerifyRefreshToken.mockResolvedValueOnce({ sub: "3" });
      mockedCreateTokenHash.mockResolvedValueOnce("hash");
      mockedRefreshRepo.queryByUserIdAndTokenHash.mockResolvedValueOnce(dbRow({
        isRevoked: 0,
        expiration: new Date(Date.now() - 60_000),
      }));

      await expect(UserService.refreshAccessToken(req, res)).rejects.toBeInstanceOf(
        ForbiddenError
      );
      expect(mockedRefreshRepo.updateTokenRevokedStatus).toHaveBeenCalledWith(
        "hash",
        1,
        3
      );
      expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
      expect(mockedRefreshRepo.revokeActiveTokenByHash).not.toHaveBeenCalled();
    });

    it("throws UnauthorizedError when token subject is invalid", async () => {
      const req = createRequest({
        cookies: { refreshToken: "token" },
      });
      const res = createResponse();

      mockedVerifyRefreshToken.mockResolvedValueOnce({
        sub: "3junk",
      });

      await expect(UserService.refreshAccessToken(req, res)).rejects.toBeInstanceOf(
        UnauthorizedError
      );
    });
  });

  describe("logout", () => {
    it.each([42, {}, ["token"], null, ""])(
      "clears malformed cookies without hashing them: %p", async (refreshToken) => {
        const req = createRequest();
        req.cookies.refreshToken = refreshToken;
        const res = createResponse();
        await expect(UserService.logout(req, res)).resolves.toBe(true);
        expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
        expect(mockedCreateTokenHash).not.toHaveBeenCalled();
      }
    );
    it("clears cookie and returns true when no refresh token exists", async () => {
      const req = createRequest({ cookies: {} });
      const res = createResponse();

      const result = await UserService.logout(req, res);

      expect(result).toBe(true);
      expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
      expect(mockedRefreshRepo.updateTokenRevokedStatus).not.toHaveBeenCalled();
    });

    it("revokes token, clears cookie and returns true when refresh token is present", async () => {
      const req = createRequest({
        cookies: { refreshToken: "oldToken" },
      });
      const res = createResponse();

      mockedCreateTokenHash.mockResolvedValueOnce("hash");

      const result = await UserService.logout(req, res);

      expect(result).toBe(true);
      expect(mockedCreateTokenHash).toHaveBeenCalledWith("oldToken");
      expect(mockedRefreshRepo.updateTokenRevokedStatus).toHaveBeenCalledWith(
        "hash",
        1
      );
      expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
    });
  });

  describe("createUser", () => {
    const input: UserInput = {
      email: "new@example.com",
      password: "Password123",
    };

    it("hashes password, creates user, and returns true", async () => {
      mockedUserRepo.queryByEmail.mockResolvedValueOnce(null);
      mockedHashPassword.mockResolvedValueOnce("hashedPw");
      mockedUserRepo.createUser.mockResolvedValueOnce(1);

      const result = await UserService.createUser({ ...input });

      expect(result).toBe(true);
      expect(mockedHashPassword).toHaveBeenCalledWith(input.password);
      expect(mockedUserRepo.createUser).toHaveBeenCalledWith({
        email: input.email,
        password: "hashedPw",
      });
    });

    it("throws ConflictError when user already exists", async () => {
      mockedUserRepo.queryByEmail.mockResolvedValueOnce(dbRow({
        userId: 1,
        email: input.email,
        password: "existing",
      }));

      await expect(UserService.createUser(input)).rejects.toBeInstanceOf(
        ConflictError
      );
      expect(mockedHashPassword).not.toHaveBeenCalled();
    });
  });

  it("deletes user by id", async () => {
    mockedUserRepo.deleteUser.mockResolvedValueOnce(1);

    const result = await UserService.deleteUser(5);

    expect(result).toBe(1);
    expect(mockedUserRepo.deleteUser).toHaveBeenCalledWith(5);
  });
});
