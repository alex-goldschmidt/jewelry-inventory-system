import jwt from "jsonwebtoken";
import { z } from "zod";

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

// Reject partial parses ("7abc"), fractions, zero, and unsafe numeric IDs.
export const UserIdStringSchema = z.string().regex(POSITIVE_INTEGER_PATTERN).refine(
  (value) => Number.isSafeInteger(Number(value))
);

const TokenClaimsSchema = z.object({ sub: UserIdStringSchema }).loose();

export type TokenClaims = z.infer<typeof TokenClaimsSchema>;

export function parseTokenClaims(payload: unknown): TokenClaims {
  const result = TokenClaimsSchema.safeParse(payload);
  if (!result.success) {
    throw new jwt.JsonWebTokenError("Invalid token claims");
  }
  return result.data;
}
