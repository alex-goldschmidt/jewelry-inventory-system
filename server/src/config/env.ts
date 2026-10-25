import { HttpStatusCode } from "../constants/constants";
import { AppError } from "./exceptions";

export const JwtSecretEnv = {
  AccessToken: "JWT_ACCESS_TOKEN_SECRET",
  RefreshToken: "JWT_REFRESH_TOKEN_SECRET",
} as const;

export type JwtSecretEnvName = (typeof JwtSecretEnv)[keyof typeof JwtSecretEnv];

export function getRequiredEnv(name: JwtSecretEnvName): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new AppError(
      HttpStatusCode.SERVER_ERROR,
      `Missing required environment variable: ${name}`
    );
  }
  return value;
}
