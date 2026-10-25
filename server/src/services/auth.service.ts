import { UserRepository } from "../repositories/auth.repository";
import { toUserModel } from "../mappers/user.mapper";
import { validateWithZod } from "../utils/errorValidator";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "../config/exceptions";
import { hashPassword } from "../utils/password";
import { UserInput, UserInputSchema } from "../models/userCreateInput.model";
import { CreateUserRecord } from "../types/createUserRecord";
import { User } from "../models/user.model";
import { verify } from "@node-rs/argon2";
import { Request, Response } from "express";
import {
  clearRefreshTokenCookie,
  createTokenHash,
  generateTokenPair,
  handleRefreshToken,
  TokenPair,
  verifyRefreshToken,
} from "../utils/jwt";
import dotenv from "dotenv";
import { RefreshTokenRepository } from "../repositories/refreshToken.repository";
import { z } from "zod";
import { UserIdStringSchema } from "../utils/authClaims";
dotenv.config();

const RefreshTokenCookieSchema = z.object({
  refreshToken: z.string().min(1),
});

function readRefreshToken(cookies: unknown): string | undefined {
  const result = RefreshTokenCookieSchema.safeParse(cookies);
  return result.success ? result.data.refreshToken : undefined;
}

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$taWh6nrERdcm9BHI2lZJwQ$ed0QBVeqDFJZo6SmyoIh7/LTYd2JNc1E4ognqo4WoTk";

function isExpired(expiration: string | Date): boolean {
  return new Date(expiration).getTime() <= Date.now();
}

export class UserService {
  static async getSingleUserById(userId: number): Promise<User | null> {
    const result = await UserRepository.queryByUserId(userId);
    const user = result ? toUserModel(result) : null;
    return user;
  }

  static async signIn(userInput: UserInput): Promise<TokenPair> {
    const validatedUser = validateWithZod(UserInputSchema, userInput);
    const existingUser = await UserRepository.queryByEmail(validatedUser.email);

    const isPasswordValid = await verify(
      existingUser?.password ?? DUMMY_PASSWORD_HASH,
      validatedUser.password
    );

    if (!existingUser || !isPasswordValid) {
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
    }

    const tokenPair = await generateTokenPair(existingUser.userId);

    await handleRefreshToken(
      tokenPair.refreshToken,
      existingUser.userId,
      tokenPair.refreshTokenExpiration
    );

    return tokenPair;
  }

  static async refreshAccessToken(
    req: Request,
    res: Response
  ): Promise<TokenPair> {
    const oldRefreshToken = readRefreshToken(req.cookies);

    if (!oldRefreshToken) {
      throw new UnauthorizedError("Missing Token");
    }

    const decoded = await verifyRefreshToken(oldRefreshToken);

    const subject = UserIdStringSchema.safeParse(decoded.sub);
    if (!subject.success) {
      throw new UnauthorizedError("Invalid user identifier in token");
    }
    const userId = Number(subject.data);

    const oldRefreshTokenHash = await createTokenHash(oldRefreshToken);
    const refreshTokenInDb =
      await RefreshTokenRepository.queryByUserIdAndTokenHash(
        userId,
        oldRefreshTokenHash
      );

    if (!refreshTokenInDb) {
      throw new UnauthorizedError("Invalid Token");
    }

    if (isExpired(refreshTokenInDb.expiration)) {
      await RefreshTokenRepository.updateTokenRevokedStatus(
        oldRefreshTokenHash,
        1,
        userId
      );
      await clearRefreshTokenCookie(res);
      throw new ForbiddenError("Token expired");
    }

    const revokedRows = await RefreshTokenRepository.revokeActiveTokenByHash(
      oldRefreshTokenHash,
      userId
    );

    if (revokedRows === 0) {
      await RefreshTokenRepository.revokeAllActiveTokensForUser(userId);
      await clearRefreshTokenCookie(res);
      throw new ForbiddenError("Refresh token reuse detected");
    }

    const newTokenPair = await generateTokenPair(userId);

    await handleRefreshToken(
      newTokenPair.refreshToken,
      userId,
      newTokenPair.refreshTokenExpiration
    );

    return newTokenPair;
  }

  static async logout(req: Request, res: Response): Promise<boolean> {
    const oldRefreshToken = readRefreshToken(req.cookies);

    if (!oldRefreshToken) {
      await clearRefreshTokenCookie(res);
      return true;
    }
    const tokenHash = await createTokenHash(oldRefreshToken);

    await RefreshTokenRepository.updateTokenRevokedStatus(tokenHash, 1);

    await clearRefreshTokenCookie(res);

    return true;
  }

  static async createUser(userInput: UserInput): Promise<boolean> {
    const validatedUser = validateWithZod(UserInputSchema, userInput);
    const isExistingUser = await UserRepository.queryByEmail(
      validatedUser.email
    );

    if (isExistingUser) {
      throw new ConflictError("User with this email already exists.");
    }

    const hashedPassword = await hashPassword(validatedUser.password);

    const user: CreateUserRecord = {
      email: validatedUser.email,
      password: hashedPassword,
    };

    return (await UserRepository.createUser(user)) > 0;
  }

  static async deleteUser(userId: number): Promise<number> {
    return await UserRepository.deleteUser(userId);
  }
}
